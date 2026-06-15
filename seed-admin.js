const prisma = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
    try {
        const name = "Teachures";
        const email = "teachures@gmail.com";
        const plainPassword = "n)hHgEgS!Qie3#Qkaq3%k!Y7";
        
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(plainPassword, salt);

        const admin = await prisma.user.upsert({
            where: { email },
            update: {
                name,
                passwordHash,
                role: 'ADMINISTRATOR',
                isVerified: true
            },
            create: {
                email,
                name,
                passwordHash,
                role: 'ADMINISTRATOR',
                isVerified: true
            }
        });

        console.log("Admin successfully created/updated:", admin.email);
    } catch (e) {
        console.error("Failed to seed admin:", e);
    } finally {
        await prisma.$disconnect();
    }
}

seedAdmin();
