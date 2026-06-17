const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const defaultBadges = [
        {
            name: 'First Course Completed',
            description: 'Awarded for completing your very first course.',
            iconUrl: '/img/badges/first-course.png',
            condition: 'complete_1_course',
            points: 50
        },
        {
            name: 'Quiz Master',
            description: 'Scored 100% on a quiz.',
            iconUrl: '/img/badges/quiz-master.png',
            condition: 'quiz_100_percent',
            points: 30
        },
        {
            name: 'Top 10% Leaderboard',
            description: 'Achieved a spot in the top 10% of global learners.',
            iconUrl: '/img/badges/top-10.png',
            condition: 'top_10_percent',
            points: 100
        }
    ];

    for (const badge of defaultBadges) {
        // Upsert to prevent duplicates if run multiple times
        const existing = await prisma.badge.findFirst({ where: { condition: badge.condition } });
        if (!existing) {
            await prisma.badge.create({ data: badge });
            console.log(`Seeded badge: ${badge.name}`);
        } else {
            console.log(`Badge already exists: ${badge.name}`);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
