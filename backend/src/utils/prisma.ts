/**
 * Central Database Access Layer.
 * Re-exports the fail-closed tenant-scoped Prisma client and scoping utilities.
 * Every query executed through `prisma` requires an active tenant context via AsyncLocalStorage
 * or an explicit `withoutTenant()` call.
 */
export {
    prisma,
    withTenant,
    withoutTenant,
    continueRequestInTenant,
    getTenantContext,
    tenantStorage,
    type TenantContext
} from './tenant.prisma';