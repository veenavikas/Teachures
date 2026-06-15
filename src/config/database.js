const { PrismaClient } = require('@prisma/client');

// Hostinger's environment variable manager sometimes adds unwanted backslashes before special characters
if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\\%/g, '%').replace(/\\/g, '');
}

const prisma = new PrismaClient();

module.exports = prisma;
