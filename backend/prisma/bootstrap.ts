/**
 * First-run setup for a new company installation.
 *
 * Creates the Organization and its first Admin user. Safe to run on a real
 * database: it refuses to do anything if users already exist, and it never
 * deletes data. (The demo data script lives in prisma/seed.ts and is separate.)
 *
 * Usage (values can also come from BOOTSTRAP_* environment variables):
 *   npm run bootstrap -- --company "Acme Ltd" --email admin@acme.com --name "Asha Rao"
 * If --password is omitted a strong random one is generated and printed once.
 */
import 'dotenv/config';
import crypto from 'crypto';
import readline from 'readline/promises';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_ORG_SETTINGS } from '../src/services/settings.service';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const arg = (name: string): string | undefined => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
};

const generatePassword = (): string => {
    // 20 chars from an unambiguous alphabet, guaranteed to include each class.
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[crypto.randomInt(set.length)];
    const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    while (chars.length < 20) chars.push(pick(all));
    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
};

async function main() {
    const existingUsers = await prisma.user.count();
    if (existingUsers > 0) {
        console.error('This database already has users. Bootstrap only runs on an empty installation.');
        console.error('Nothing was changed.');
        process.exit(1);
    }

    let company = arg('company') || process.env.BOOTSTRAP_COMPANY_NAME;
    let email = arg('email') || process.env.BOOTSTRAP_ADMIN_EMAIL;
    let name = arg('name') || process.env.BOOTSTRAP_ADMIN_NAME;
    let password = arg('password') || process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if ((!company || !email || !name) && process.stdin.isTTY) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        company = company || (await rl.question('Company name: '));
        name = name || (await rl.question('Admin full name: '));
        email = email || (await rl.question('Admin email: '));
        rl.close();
    }

    company = company?.trim();
    name = name?.trim();
    email = email?.trim().toLowerCase();

    if (!company || !name || !email) {
        console.error('Missing values. Provide --company, --name and --email (or BOOTSTRAP_* env vars).');
        process.exit(1);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        console.error(`"${email}" is not a valid email address.`);
        process.exit(1);
    }

    let generated = false;
    if (!password) {
        password = generatePassword();
        generated = true;
    } else if (password.length < 12) {
        console.error('Admin password must be at least 12 characters.');
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { org, admin } = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
            data: {
                name: company!,
                // Holidays are country-specific, so start empty and let the admin configure them.
                settings: { ...DEFAULT_ORG_SETTINGS, holidays: [] } as any,
            },
        });
        const admin = await tx.user.create({
            data: { email: email!, name: name!, role: 'ADMIN', passwordHash, organizationId: org.id },
        });
        return { org, admin };
    });

    console.log('\n=========================================');
    console.log(' Setup complete');
    console.log('=========================================');
    console.log(` Company : ${org.name}`);
    console.log(` Admin   : ${admin.email}`);
    if (generated) {
        console.log(` Password: ${password}`);
        console.log('\n Save this password now - it is not stored anywhere and will not be shown again.');
        console.log(' Change it after your first sign-in.');
    }
    console.log('\n Next: sign in, then add departments, teams and employees from the admin dashboard.\n');
}

main()
    .catch((e) => {
        console.error('Bootstrap failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
