const express = require('express');
const router = express.Router();
const prisma = require('../config/database');

const renderOrFallback = async (slug, req, res, fallbackTemplate, fallbackContext = {}) => {
    try {
        const page = await prisma.page.findUnique({ where: { slug } });
        if (page && !page.isDraft) {
            return res.render('public/dynamic-page', { 
                layout: 'layouts/main', 
                page, 
                seoTitle: page.seoTitle || page.title, 
                seoDesc: page.seoDesc 
            });
        }
    } catch(e) {
        console.error(`Error loading dynamic page ${slug}:`, e);
    }
    // Fallback to static EJS template
    res.render(fallbackTemplate, { layout: false, ...fallbackContext });
};

// All public pages are standalone HTML — disable ejs-layouts wrapping unless overridden by CMS
router.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    await renderOrFallback('home', req, res, 'public/index');
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

router.get('/about', async (req, res) => {
    await renderOrFallback('about', req, res, 'public/about');
});

router.get('/privacy-policy', async (req, res) => {
    await renderOrFallback('privacy-policy', req, res, 'public/privacy');
});

router.get('/terms', async (req, res) => {
    await renderOrFallback('terms', req, res, 'public/terms');
});

router.get('/login', (req, res) => {
    res.render('auth/login', { layout: 'layouts/auth', title: 'Login' });
});

router.get('/register', (req, res) => {
    res.render('auth/register', { layout: 'layouts/auth', title: 'Register' });
});

router.get('/login-2fa', (req, res) => {
    res.render('auth/login-2fa', { layout: 'layouts/auth', title: '2FA Verification', email: req.query.email });
});

router.get('/courses/:slug', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({ 
            where: { slug: req.params.slug },
            include: { 
                ratings: { 
                    include: { user: { select: { name: true, avatar: true } } },
                    orderBy: { createdAt: 'desc' }
                },
                prerequisites: {
                    include: { prerequisite: true }
                },
                announcements: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!course) return res.status(404).send('Course not found');

        let prereqsMet = true;
        let pendingPrereqs = [];

        if (course.prerequisites && course.prerequisites.length > 0) {
            if (!req.user) {
                prereqsMet = false;
                pendingPrereqs = course.prerequisites.map(p => p.prerequisite);
            } else {
                // Check user's progress for each prerequisite course
                const progressRecords = await prisma.courseProgress.findMany({
                    where: {
                        userId: req.user.id,
                        courseId: { in: course.prerequisites.map(p => p.prerequisiteId) }
                    }
                });
                
                for (const prereq of course.prerequisites) {
                    const prog = progressRecords.find(p => p.courseId === prereq.prerequisiteId);
                    if (!prog || prog.percentComplete < 100) {
                        prereqsMet = false;
                        pendingPrereqs.push(prereq.prerequisite);
                    }
                }
            }
        }
        
        res.render('public/course', { layout: false, course, prerequisites: course.prerequisites, prereqsMet, pendingPrereqs, announcements: course.announcements });
    } catch (error) {
        res.status(500).send('Server error');
    }
});

router.get('/courses/:slug/checkout', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({ 
            where: { slug: req.params.slug },
            include: {
                prerequisites: { include: { prerequisite: true } }
            }
        });
        if (!course) return res.status(404).send('Course not found');

        let prereqsMet = true;
        if (course.prerequisites && course.prerequisites.length > 0) {
            if (!req.user) {
                prereqsMet = false;
            } else {
                const progressRecords = await prisma.courseProgress.findMany({
                    where: {
                        userId: req.user.id,
                        courseId: { in: course.prerequisites.map(p => p.prerequisiteId) }
                    }
                });
                for (const prereq of course.prerequisites) {
                    const prog = progressRecords.find(p => p.courseId === prereq.prerequisiteId);
                    if (!prog || prog.percentComplete < 100) {
                        prereqsMet = false;
                        break;
                    }
                }
            }
        }

        if (!prereqsMet) {
            return res.status(403).send('You have not completed the prerequisites for this course.');
        }

        res.render('public/checkout', {
            layout: false,
            course,
            paypalClientId: process.env.PAYPAL_CLIENT_ID || 'sb'
        });
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Dynamic Pages
router.get('/p/:slug', async (req, res) => {
    try {
        const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
        if (!page || page.isDraft) {
            return res.status(404).send('Page not found');
        }
        res.render('public/dynamic-page', { 
            layout: 'layouts/main', 
            page, 
            seoTitle: page.seoTitle || page.title, 
            seoDesc: page.seoDesc 
        });
    } catch (error) {
        res.status(500).send('Server error loading page');
    }
});

module.exports = router;
