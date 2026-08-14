import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash('password123', 10);

    // Clean DB
    await prisma.teamMember.deleteMany();
    await prisma.team.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();

    const org = await prisma.organization.create({
        data: { name: 'TaskBot Inc.' }
    });

    const admin = await prisma.user.create({
        data: {
            email: 'admin@taskbot.com',
            passwordHash,
            name: 'Admin User',
            role: Role.ADMIN,
            organizationId: org.id
        }
    });

    // 2 Managers
    const manager1 = await prisma.user.create({ data: { email: 'manager1@taskbot.com', passwordHash, name: 'Manager One', role: Role.MANAGER, organizationId: org.id } });
    const manager2 = await prisma.user.create({ data: { email: 'manager2@taskbot.com', passwordHash, name: 'Manager Two', role: Role.MANAGER, organizationId: org.id } });

    // 4 Team Leads (2 per manager)
    const tl1 = await prisma.user.create({ data: { email: 'tl1@taskbot.com', passwordHash, name: 'Lead 1', role: Role.TEAM_LEAD, organizationId: org.id, managerId: manager1.id } });
    const tl2 = await prisma.user.create({ data: { email: 'tl2@taskbot.com', passwordHash, name: 'Lead 2', role: Role.TEAM_LEAD, organizationId: org.id, managerId: manager1.id } });
    const tl3 = await prisma.user.create({ data: { email: 'tl3@taskbot.com', passwordHash, name: 'Lead 3', role: Role.TEAM_LEAD, organizationId: org.id, managerId: manager2.id } });
    const tl4 = await prisma.user.create({ data: { email: 'tl4@taskbot.com', passwordHash, name: 'Lead 4', role: Role.TEAM_LEAD, organizationId: org.id, managerId: manager2.id } });

    const teamLeads = [tl1, tl2, tl3, tl4];

    // 12 employees (3 per lead)
    for (let i = 0; i < 12; i++) {
        const tl = teamLeads[Math.floor(i / 3)];
        const emp = await prisma.user.create({ data: { email: `emp${i + 1}@taskbot.com`, passwordHash, name: `Employee ${i + 1}`, role: Role.EMPLOYEE, organizationId: org.id, managerId: tl.id } });

        let team = await prisma.team.findFirst({ where: { teamLeadId: tl.id } });
        if (!team) {
            team = await prisma.team.create({ data: { name: `Team ${tl.name}`, organizationId: org.id, teamLeadId: tl.id } });
        }

        await prisma.teamMember.create({ data: { teamId: team.id, userId: emp.id } });
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
