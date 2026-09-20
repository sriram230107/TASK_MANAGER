import { describe, it, expect, beforeEach } from 'vitest';
import { isValidTimezone, getOrganizationDayRange, formatDateInTimezone } from '../utils/timezone';
import { prisma } from '../utils/prisma';
import { cleanDatabase } from './setup';
import { createTestOrg, createTestUser } from './helpers/test-app';
import { getOrganizationSettings, updateOrganizationSettings } from '../services/settings.service';
import { Role } from '@prisma/client';

describe('Timezone Utility', () => {
    it('validates standard timezones including UTC and Asia/Kolkata', () => {
        expect(isValidTimezone('UTC')).toBe(true);
        expect(isValidTimezone('Asia/Kolkata')).toBe(true);
        expect(isValidTimezone('America/New_York')).toBe(true);
        expect(isValidTimezone('Europe/London')).toBe(true);
    });

    it('rejects invalid or unsafe timezone strings', () => {
        expect(isValidTimezone('Invalid/Timezone')).toBe(false);
        expect(isValidTimezone('')).toBe(false);
        expect(isValidTimezone('Moon/Base')).toBe(false);
        expect(isValidTimezone('12345')).toBe(false);
        expect(isValidTimezone('../UTC')).toBe(false);
    });

    it('calculates correct day boundaries for UTC', () => {
        const testDate = new Date('2026-09-20T12:00:00.000Z');
        const { startOfDay, endOfDay } = getOrganizationDayRange(testDate, 'UTC');

        expect(startOfDay.toISOString()).toBe('2026-09-20T00:00:00.000Z');
        expect(endOfDay.toISOString()).toBe('2026-09-20T23:59:59.999Z');
    });

    it('calculates correct day boundaries for Asia/Kolkata (UTC+5:30)', () => {
        const testDate = new Date('2026-09-20T02:00:00.000Z');
        const { startOfDay, endOfDay } = getOrganizationDayRange(testDate, 'Asia/Kolkata');

        expect(startOfDay.toISOString()).toBe('2026-09-19T18:30:00.000Z');
        expect(endOfDay.toISOString()).toBe('2026-09-20T18:29:59.999Z');
    });

    it('formats dates consistently in specified timezone', () => {
        const utcDate = new Date('2026-09-20T18:30:00.000Z');
        const formattedKolkata = formatDateInTimezone(utcDate, 'Asia/Kolkata');
        expect(formattedKolkata).toBe('2026-09-21');
    });
});

describe('Organization Settings Timezone Persistence', () => {
    beforeEach(async () => {
        await cleanDatabase();
    });

    it('persists and retrieves organization timezone in settings JSON without schema column', async () => {
        const org = await createTestOrg('Timezone Persistence Org');
        const admin = await createTestUser({
            orgId: org.id,
            role: 'ADMIN',
            email: 'admin.timezone@test.com'
        });

        const userContext = {
            id: admin.id,
            role: Role.ADMIN,
            organizationId: org.id
        };

        // 1. Initial timezone defaults to UTC from settings JSON
        const initial = await getOrganizationSettings(userContext);
        expect(initial.timezone).toBe('UTC');

        // 2. Update timezone to Asia/Kolkata
        await updateOrganizationSettings(userContext, {
            timezone: 'Asia/Kolkata'
        });

        // 3. Verify settings JSON in database was updated
        const dbOrg = await prisma.organization.findUnique({
            where: { id: org.id }
        });
        const settings = dbOrg?.settings as Record<string, any>;
        expect(settings?.timezone).toBe('Asia/Kolkata');

        // 4. Verify getOrganizationSettings returns the updated timezone
        const updated = await getOrganizationSettings(userContext);
        expect(updated.timezone).toBe('Asia/Kolkata');
    });
});
