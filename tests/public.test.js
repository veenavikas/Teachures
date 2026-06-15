const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/database');

describe('Public API Endpoints', () => {
    // Teardown to prevent open handles
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('should return 200 OK for the health check', async () => {
        const res = await request(app).get('/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body.status).toBe('OK');
    });

    it('should return a list of published courses', async () => {
        const res = await request(app).get('/api/v1/courses');
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});
