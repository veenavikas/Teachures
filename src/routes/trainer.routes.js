const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');


router.use(requireAuth, requireRole('TRAINER'));

// Trainer Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const courseCount = await prisma.course.count({ where: { trainerId: req.user.id } });

        // In a real app, this data would come from complex aggregations
        const stats = {
            totalStudents: 145,
            monthlyEarnings: 1250,
            activeCourses: courseCount,
            avgRating: 4.8,
            totalReviews: 32
        };

        const recentActivity = [
            { text: 'Jane completed "Intro to Node.js"', time: '2 hours ago' },
            { text: 'New enrollment: Mark Smith', time: '5 hours ago' },
            { text: '5-star review received', time: 'Yesterday' }
        ];

        res.render('trainer/dashboard', {
            layout: 'layouts/dashboard',
            title: 'Trainer Dashboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-trainer',
            stats,
            recentActivity
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// My Courses List
router.get('/courses', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { trainerId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });

        res.render('trainer/courses/index', {
            layout: 'layouts/dashboard',
            title: 'My Courses',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-trainer',
            courses
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Create Course Wizard
router.get('/courses/create', (req, res) => {
    res.render('trainer/courses/create', {
        layout: 'layouts/dashboard',
        title: 'Create Course',
        path: req.originalUrl,
        user: req.user,
        sidebarPartial: '../partials/sidebar-trainer'
    });
});

// Course Editor
router.get('/courses/:id/edit', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id }
        });

        if (!course || course.trainerId !== req.user.id) {
            return res.status(404).send('Course not found');
        }

        res.render('trainer/courses/edit', {
            layout: 'layouts/dashboard',
            title: `Edit: ${course.title}`,
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-trainer',
            course
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Trainer Analytics
router.get('/analytics', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { trainerId: req.user.id },
            include: {
                _count: { select: { enrollments: true } },
                ratings: { select: { rating: true } }
            }
        });

        let totalStudents = 0, totalRevenue = 0, totalRatingSum = 0, ratingCount = 0;
        courses.forEach(c => {
            totalStudents += c._count.enrollments;
            totalRevenue += c._count.enrollments * (c.price || 0);
            c.ratings.forEach(r => { totalRatingSum += r.rating; ratingCount++; });
        });

        const analytics = {
            totalCourses: courses.length,
            totalStudents,
            totalRevenue,
            avgRating: ratingCount > 0 ? totalRatingSum / ratingCount : 0,
            ratingCount,
            courses
        };

        res.render('trainer/analytics', {
            layout: 'layouts/dashboard',
            title: 'Analytics',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-trainer',
            analytics
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.get('/privacy', async (req, res) => {
    const logs = await prisma.consentLog.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' }
    });
    const consent = { essential: true, analytics: false, marketing: false };
    const found = new Set();
    for (const log of logs) {
        if (!found.has(log.type)) {
            consent[log.type] = log.accepted;
            found.add(log.type);
        }
        if (found.size >= 3) break;
    }

    // Share the same view as learner since features are identical
    res.render('learner/privacy', {
        title: 'Privacy & Data',
        path: '/trainer/privacy',
        consent
    });
});

module.exports = router;
