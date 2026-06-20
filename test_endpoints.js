const axios = require('axios');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
    console.log('--- Starting Route Audit ---');
    
    // Create test users
    const student = await prisma.user.findFirst({ where: { role: 'STUDENT' } }) || { id: 'test-student', role: 'STUDENT' };
    const instructor = await prisma.user.findFirst({ where: { role: 'INSTRUCTOR' } }) || { id: 'test-instructor', role: 'INSTRUCTOR' };
    const admin = await prisma.user.findFirst({ where: { role: 'ADMINISTRATOR' } }) || { id: 'test-admin', role: 'ADMINISTRATOR' };

    const genToken = (user) => {
        return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    };

    const studentToken = genToken(student);
    const instructorToken = genToken(instructor);
    const adminToken = genToken(admin);

    const checkRoute = async (route, token, roleName) => {
        try {
            const res = await axios.get(`${BASE_URL}${route}`, {
                headers: { Cookie: `accessToken=${token}` },
                validateStatus: () => true
            });
            console.log(`[${roleName}] GET ${route} -> Status: ${res.status}`);
            if (res.status >= 500) {
                console.error(`ERROR: ${route} crashed!`);
            }
        } catch (e) {
            console.error(`ERROR: ${route} failed - ${e.message}`);
        }
    };

    const studentRoutes = ['/student/dashboard', '/student/gamification', '/student/my-courses', '/student/support', '/student/profile'];
    for (const r of studentRoutes) await checkRoute(r, studentToken, 'STUDENT');

    const instructorRoutes = ['/instructor/dashboard', '/instructor/courses', '/instructor/assignments', '/instructor/earnings', '/instructor/profile'];
    for (const r of instructorRoutes) await checkRoute(r, instructorToken, 'INSTRUCTOR');

    const adminRoutes = ['/admin/dashboard', '/admin/users', '/admin/courses', '/admin/revenue', '/admin/support', '/admin/settings'];
    for (const r of adminRoutes) await checkRoute(r, adminToken, 'ADMIN');

    console.log('--- Audit Complete ---');
}

runTests()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
