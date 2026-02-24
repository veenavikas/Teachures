const express = require('express');
const router = express.Router();
const prisma = require('../config/database');

// All public pages are standalone HTML — disable ejs-layouts wrapping
router.get('/', (req, res) => {
    res.render('public/index', { layout: false });
});

router.get('/pricing', (req, res) => {
    res.render('public/pricing', { layout: false });
});

router.get('/courses', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { isPublished: true },
            orderBy: { createdAt: 'desc' },
            include: {
                ratings: {
                    select: { rating: true }
                }
            }
        });
        res.render('public/courses-browse', { layout: false, courses });
    } catch (error) {
        res.status(500).send('Server Error loading courses');
    }
});

router.get('/about', (req, res) => {
    res.render('public/about', { layout: false });
});

router.get('/login', (req, res) => {
    res.render('auth/login', { layout: 'layouts/auth', title: 'Login' });
});

router.get('/register', (req, res) => {
    res.render('auth/register', { layout: 'layouts/auth', title: 'Register' });
});

router.get('/courses/:slug/checkout', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({ where: { slug: req.params.slug } });
        if (!course) return res.status(404).send('Course not found');
        res.render('public/checkout', {
            layout: false,
            course,
            paypalClientId: process.env.PAYPAL_CLIENT_ID || 'sb'
        });
    } catch (error) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
