/**
 * Idempotent script to backfill Organization timezone.
 *
 * Usage:
 *   npx tsx scripts/backfill-timezone.ts --timezone Asia/Kolkata --all
 *   npx tsx scripts/backfill-timezone.ts --timezone Asia/Kolkata --org-id <uuid>
 *   npx tsx scripts/backfill-timezone.ts --timezone Asia/Kolkata --all --apply
 *
 * Defaults to DRY RUN. Pass --apply to persist changes.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { isValidTimezone } from '../src/utils/timezone';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
};

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

async function main() {
    const timezone = arg('timezone');
    const orgId = arg('org-id');
    const all = hasFlag('all');
    const apply = hasFlag('apply');

    if (!timezone) {
        console.error('ERROR: --timezone <IANA> is required (e.g. --timezone Asia/Kolkata).');
        process.exit(1);
    }

    if (!isValidTimezone(timezone)) {
        console.error(`ERROR: "${timezone}" is not a valid IANA timezone name.`);
        process.exit(1);
    }

    if (!orgId && !all) {
        console.error('ERROR: Specify either --org-id <uuid> or --all to select organizations.');
        process.exit(1);
    }

    const where = orgId ? { id: orgId } : {};
    const orgs = await prisma.organization.findMany({ where });

    if (orgs.length === 0) {
        console.log('No organizations found matching the criteria.');
        process.exit(0);
    }

    console.log(`\nFound ${orgs.length} organization(s):`);
    console.log('----------------------------------------------------------------------');

    for (const org of orgs) {
        const currentTz = (org as any).timezone || (org.settings as any)?.timezone || 'UTC (not set)';
        console.log(`- Org Name: "${org.name}" | ID: ${org.id} | Current Timezone: ${currentTz}`);
        if (!apply) {
            console.log(`  [DRY RUN] Would update timezone to "${timezone}". (Pass --apply to commit)`);
        }
    }

    if (!apply) {
        console.log('\n[DRY RUN COMPLETE] No database records were modified.');
        console.log('To apply these changes, re-run with --apply:');
        console.log(`  npx tsx scripts/backfill-timezone.ts --timezone "${timezone}" ${orgId ? `--org-id "${orgId}"` : '--all'} --apply\n`);
        return;
    }

    for (const org of orgs) {
        const existingSettings = (org.settings as Record<string, any>) || {};
        const updatedSettings = { ...existingSettings, timezone };

        await prisma.organization.update({
            where: { id: org.id },
            data: {
                settings: updatedSettings
            }
        });
        console.log(`  [APPLIED] Updated organization "${org.name}" (${org.id}) timezone -> "${timezone}".`);
    }

    console.log('\n[APPLY COMPLETE] All selected organizations updated successfully.\n');
}

main()
    .catch((err) => {
        console.error('Backfill error:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
