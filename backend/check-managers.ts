import { prisma } from "./src/utils/prisma";

async function main() {
    const users = await prisma.user.findMany({
        where: {
            role: "MANAGER",
            deletedAt: null
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            managerId: true,
            organizationId: true
        }
    });

    console.log(users);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
