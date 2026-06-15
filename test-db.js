const prisma = require('./src/config/database');

async function test() {
    try {
        const user = await prisma.user.findFirst();
        console.log("DB connection successful! Found user:", user);
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
