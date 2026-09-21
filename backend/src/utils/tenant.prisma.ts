import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface TenantContext {
    organizationId: string;
    isSystem?: boolean;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

// Base unscoped PrismaClient instance (internal to this module)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const rawPrisma = new PrismaClient({ adapter });

// List of all business models that carry an organizationId field
const TENANT_MODELS = new Set([
    'department',
    'team',
    'user',
    'task',
    'goal',
    'document',
    'taskTemplate',
    'teamMember',
    'taskAssignment',
    'taskUpdate',
    'taskComment',
    'taskAttachment',
    'taskHistory',
    'recurrenceRule',
    'attendance',
    'workSession',
    'leaveRequest',
    'leaveBalance',
    'performanceReview',
    'payrollRecord',
    'notification',
    'auditLog',
    'activityLog',
    'refreshToken',
    'organizationSecret'
]);

/**
 * Creates a scoped proxy over a Prisma delegate (or tx) for a specific model.
 */
function createModelProxy(targetModel: any, modelName: string, organizationId: string) {
    const isOrgModel = modelName.toLowerCase() === 'organization';
    const isTenantModel = TENANT_MODELS.has(modelName.toLowerCase()) || isOrgModel;

    if (!isTenantModel) {
        return targetModel;
    }

    return new Proxy(targetModel, {
        get(delegate, action: string) {
            const originalMethod = delegate[action];
            if (typeof originalMethod !== 'function') {
                return originalMethod;
            }

            return async function (...args: any[]) {
                const queryArgs = args[0] || {};

                // 1. Organization model: scope id to current tenant
                if (isOrgModel) {
                    if (action === 'findUnique' || action === 'findUniqueOrThrow' || action === 'findFirst' || action === 'findFirstOrThrow') {
                        const where = queryArgs.where || {};
                        if (where.id && where.id !== organizationId) {
                            if (action.endsWith('OrThrow')) throw new Error('NotFoundError: Organization not found');
                            return null;
                        }
                        queryArgs.where = { ...where, id: organizationId };
                        return delegate[action](queryArgs);
                    }
                    if (action === 'findMany' || action === 'count') {
                        queryArgs.where = { ...(queryArgs.where || {}), id: organizationId };
                        return delegate[action](queryArgs);
                    }
                    if (action === 'update' || action === 'updateMany' || action === 'delete' || action === 'deleteMany') {
                        queryArgs.where = { ...(queryArgs.where || {}), id: organizationId };
                        return delegate[action](queryArgs);
                    }
                    return delegate[action](...args);
                }

                // 2. Tenant business models: scope by organizationId
                if (action === 'findFirst' || action === 'findFirstOrThrow' || action === 'findMany' || action === 'count' || action === 'aggregate' || action === 'groupBy') {
                    const where = queryArgs.where || {};
                    if (where.organizationId && where.organizationId !== organizationId) {
                        throw new Error('ForbiddenError: Cross-tenant query attempt detected.');
                    }
                    queryArgs.where = { ...where, organizationId };
                    return delegate[action](queryArgs);
                }

                if (action === 'findUnique' || action === 'findUniqueOrThrow') {
                    // Re-route findUnique to findFirst to enforce compound tenant scoping
                    const where = queryArgs.where || {};
                    const isThrow = action.endsWith('OrThrow');
                    const firstAction = isThrow ? 'findFirstOrThrow' : 'findFirst';
                    return delegate[firstAction]({
                        ...queryArgs,
                        where: { ...where, organizationId }
                    });
                }

                if (action === 'create') {
                    const data = queryArgs.data || {};
                    queryArgs.data = { ...data, organizationId };
                    return delegate[action](queryArgs);
                }

                if (action === 'createMany') {
                    const data = Array.isArray(queryArgs.data)
                        ? queryArgs.data.map((item: any) => ({ ...item, organizationId }))
                        : queryArgs.data;
                    queryArgs.data = data;
                    return delegate[action](queryArgs);
                }

                if (action === 'update' || action === 'updateMany' || action === 'delete' || action === 'deleteMany') {
                    const where = queryArgs.where || {};
                    if (where.organizationId && where.organizationId !== organizationId) {
                        throw new Error('ForbiddenError: Cross-tenant mutation attempt detected.');
                    }
                    queryArgs.where = { ...where, organizationId };
                    return delegate[action](queryArgs);
                }

                if (action === 'upsert') {
                    const where = queryArgs.where || {};
                    const createData = queryArgs.create || {};
                    const updateData = queryArgs.update || {};
                    queryArgs.where = { ...where, organizationId };
                    queryArgs.create = { ...createData, organizationId };
                    queryArgs.update = { ...updateData, organizationId };
                    return delegate[action](queryArgs);
                }

                return delegate[action](...args);
            };
        }
    });
}

/**
 * Wraps a Prisma client (or transaction client) in tenant scoping rules.
 */
function createScopedClient(baseClient: any, organizationId: string) {
    return new Proxy(baseClient, {
        get(target, prop: string) {
            if (prop === '$queryRaw' || prop === '$executeRaw' || prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
                return () => {
                    throw new Error('Raw SQL is forbidden on tenant-scoped Prisma client. Use model queries or withoutTenant() for system operations.');
                };
            }

            if (prop === '$transaction') {
                return async function (arg: any, options?: any) {
                    // Array of promises
                    if (Array.isArray(arg)) {
                        return target.$transaction(arg, options);
                    }
                    // Interactive transaction callback
                    if (typeof arg === 'function') {
                        return target.$transaction(async (tx: any) => {
                            const scopedTx = createScopedClient(tx, organizationId);
                            return arg(scopedTx);
                        }, options);
                    }
                    return target.$transaction(arg, options);
                };
            }

            const modelDelegate = target[prop];
            if (modelDelegate && typeof modelDelegate === 'object') {
                return createModelProxy(modelDelegate, prop, organizationId);
            }

            return modelDelegate;
        }
    });
}

/**
 * Fail-Closed Tenant-Scoped Prisma Client:
 * Reads tenant from AsyncLocalStorage. If accessed outside of tenant context or withoutTenant(),
 * it throws an error immediately.
 */
export const prisma: PrismaClient = new Proxy(rawPrisma, {
    get(target, prop: string) {
        const store = tenantStorage.getStore();

        // 1. Explicit system bypass
        if (store?.isSystem) {
            return (target as any)[prop];
        }

        // 2. Missing tenant context -> FAIL CLOSED
        if (!store?.organizationId) {
            // Allow inspect/toString/then/catch/$connect/$disconnect properties for tooling and lifecycle
            if (
                prop === 'then' ||
                prop === 'catch' ||
                prop === 'toString' ||
                prop === 'inspect' ||
                prop === '$disconnect' ||
                prop === '$connect' ||
                typeof prop === 'symbol'
            ) {
                return (target as any)[prop];
            }
            throw new Error(
                `CRITICAL: Tenant context missing! Attempted to query database (${String(prop)}) outside of a tenant context or withoutTenant().`
            );
        }

        const scoped = createScopedClient(target, store.organizationId);
        return scoped[prop];
    }
}) as PrismaClient;

/**
 * Executes a function within the specified organization tenant context.
 */
export const withTenant = <T>(organizationId: string, fn: () => T): T => {
    return tenantStorage.run({ organizationId }, fn);
};

/**
 * Executes an audited system task without tenant constraints (e.g. cron scanners, baseline scripts).
 */
export const withoutTenant = <T>(fn: (unscopedPrisma: PrismaClient) => T): T => {
    return tenantStorage.run({ isSystem: true, organizationId: '' }, () => fn(rawPrisma));
};

/**
 * Returns the current active tenant context.
 */
export const getTenantContext = (): TenantContext | undefined => {
    return tenantStorage.getStore();
};
