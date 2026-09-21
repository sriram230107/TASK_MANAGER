import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import { continueRequestInTenant, withoutTenant, getTenantContext } from '../utils/prisma';
import { errorResponse } from '../utils/response';

let cachedSingleOrgId: string | null = null;

export const clearSingleOrgCache = () => {
    cachedSingleOrgId = null;
};

/**
 * Tenant resolution middleware for Express.
 * In single-company mode (default): resolves the single organization.
 * In multi-company mode: pre-auth resolves via subdomain/company code; post-auth is handled by authenticate().
 */
export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // If already inside a tenant context, proceed
    const currentContext = getTenantContext();
    if (currentContext?.organizationId) {
        req.organizationId = currentContext.organizationId;
        return next();
    }

    // If an authorization token or cookie is present, allow request to proceed to authenticate()
    // which derives tenant strictly from req.user
    const hasAuthToken = Boolean(
        req.headers.authorization?.startsWith('Bearer ') ||
        req.cookies?.accessToken ||
        req.cookies?.token
    );
    if (hasAuthToken) {
        return next();
    }

    // 1. Single-Company Mode (Default)
    if (!config.MULTI_COMPANY_ENABLED) {
        try {
            let orgId = process.env.NODE_ENV === 'test' ? null : cachedSingleOrgId;
            if (!orgId) {
                const orgs = await withoutTenant((unscoped) =>
                    unscoped.organization.findMany({ select: { id: true } })
                );

                if (orgs.length === 0) {
                    errorResponse(res, 'No organization configured. Please run npm run bootstrap to initialize the company portal.', 503);
                    return;
                }

                if (orgs.length > 1) {
                    errorResponse(res, 'Multiple organizations detected in single-company mode. Enable MULTI_COMPANY_ENABLED or remove secondary organizations.', 500);
                    return;
                }

                orgId = orgs[0].id;
                cachedSingleOrgId = orgId;
            }

            req.organizationId = orgId;
            continueRequestInTenant(orgId, next);
            return;
        } catch (err: any) {
            console.error('Tenant resolution error (single-company):', err);
            errorResponse(res, 'Failed to resolve organization', 500);
            return;
        }
    }

    // 2. Multi-Company Mode
    // A. Post-authentication: strictly derive from req.user
    if (req.user?.organizationId) {
        req.organizationId = req.user.organizationId;
        continueRequestInTenant(req.user.organizationId, next);
        return;
    }

    // B. Pre-authentication / Public requests
    let companyIdentifier: string | undefined;

    // Check host for subdomain (e.g. acme.portal.local -> acme)
    const host = req.hostname || req.headers.host || '';
    const parts = host.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
        companyIdentifier = parts[0];
    }

    // Fallback to company code in body or query
    if (!companyIdentifier) {
        companyIdentifier = (req.body?.companyCode as string) || (req.query?.companyCode as string);
    }

    if (!companyIdentifier) {
        // If there is only 1 organization registered in the database, fall back to it
        try {
            const orgs = await withoutTenant((unscoped) =>
                unscoped.organization.findMany({ select: { id: true } })
            );
            if (orgs.length === 1) {
                req.organizationId = orgs[0].id;
                continueRequestInTenant(orgs[0].id, next);
                return;
            }
        } catch {}

        // Proceed without tenant context (public endpoints that don't need tenant or login will validate)
        next();
        return;
    }

    try {
        const org = await withoutTenant((unscoped) =>
            unscoped.organization.findFirst({
                where: {
                    OR: [
                        { id: companyIdentifier },
                        { name: { equals: companyIdentifier, mode: 'insensitive' } }
                    ]
                },
                select: { id: true }
            })
        );

        if (!org) {
            errorResponse(res, `Organization "${companyIdentifier}" not found.`, 404);
            return;
        }

        req.organizationId = org.id;
        withTenant(org.id, () => {
            next();
        });
        return;
    } catch (err: any) {
        console.error('Tenant resolution error (multi-company):', err);
        errorResponse(res, 'Failed to resolve organization', 500);
    }
};
