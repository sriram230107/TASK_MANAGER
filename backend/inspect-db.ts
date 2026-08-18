import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

async function main() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter });

    try {
        const orgs = await prisma.organization.findMany();
        console.log('ORG_COUNT:', orgs.length);
        for (const o of orgs) console.log('ORG:', o.id, o.name);

        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, managerId: true }
        });
        console.log('USER_COUNT:', users.length);
        for (const u of users) console.log('USER:', u.role, u.email, 'id=' + u.id, 'mgr=' + u.managerId);

        const teams = await prisma.team.findMany({
            select: { id: true, name: true, teamLeadId: true, organizationId: true }
        });
        console.log('TEAM_COUNT:', teams.length);
        for (const t of teams) console.log('TEAM:', t.name, 'id=' + t.id, 'leadId=' + t.teamLeadId);

        const taskCount = await prisma.task.count();
        console.log('TASK_COUNT:', taskCount);

        const members = await prisma.teamMember.findMany({ select: { teamId: true, userId: true } });
        console.log('MEMBER_COUNT:', members.length);
        for (const m of members) console.log('MEMBER: teamId=' + m.teamId, 'userId=' + m.userId);

    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => {
    console.error(e.message);
    process.exit(1);
});
