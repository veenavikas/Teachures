const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');


router.use(requireAuth, requireRole('INSTRUCTOR'));

// Instructor Onboarding
router.get('/onboarding', async (req, res) => {
    try {
        const profile = await prisma.instructorProfile.findUnique({
            where: { userId: req.user.id }
        });
        
        // If already onboarded, redirect to dashboard
        if (profile && profile.paypalAccountId && profile.bio) {
            return res.redirect('/instructor/dashboard');
        }

        res.render('instructor/onboarding', {
            layout: 'layouts/dashboard',
            title: 'Trainer Onboarding',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor'
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.post('/onboarding', async (req, res) => {
    try {
        const { bio, expertise, website, paypalAccountId } = req.body;
        
        // Validate required fields
        if (!paypalAccountId) {
            return res.status(400).json({ success: false, message: 'PayPal Account ID is required for payouts.' });
        }

        const profile = await prisma.instructorProfile.upsert({
            where: { userId: req.user.id },
            update: { bio, expertise, website, paypalAccountId },
            create: { userId: req.user.id, bio, expertise, website, paypalAccountId }
        });

        res.json({ success: true, data: profile });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error during onboarding.' });
    }
});

// Instructor Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const courseCount = await prisma.course.count({ where: { instructorId: req.user.id } });

        // Real analytics for instructor
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            include: {
                _count: { select: { enrollments: true } },
                ratings: { select: { rating: true } },
                enrollments: {
                    include: { payment: true, user: true },
                    orderBy: { enrolledAt: 'desc' },
                    take: 5
                }
            }
        });

        let totalStudents = 0, monthlyEarnings = 0, totalRatingSum = 0, ratingCount = 0;
        let recentEnrollments = [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        courses.forEach(c => {
            totalStudents += c._count.enrollments;
            c.ratings.forEach(r => { totalRatingSum += r.rating; ratingCount++; });
            c.enrollments.forEach(e => {
                recentEnrollments.push({ text: `New enrollment: ${e.user.name} in "${c.title}"`, time: e.enrolledAt.toLocaleDateString() });
                if (e.payment && e.payment.status === 'COMPLETED' && e.payment.createdAt >= thirtyDaysAgo) {
                    monthlyEarnings += e.payment.amount;
                }
            });
        });

        // Sort and limit recent activity
        recentEnrollments.sort((a, b) => new Date(b.time) - new Date(a.time));
        const recentActivity = recentEnrollments.slice(0, 5);

        const stats = {
            totalStudents,
            monthlyEarnings,
            activeCourses: courseCount,
            avgRating: ratingCount > 0 ? (totalRatingSum / ratingCount).toFixed(1) : 0,
            totalReviews: ratingCount
        };

        res.render('instructor/dashboard', {
            layout: 'layouts/dashboard',
            title: 'Instructor Dashboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
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
            where: { instructorId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });

        res.render('instructor/courses/index', {
            layout: 'layouts/dashboard',
            title: 'My Courses',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            courses
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Create Course Wizard
router.get('/courses/create', (req, res) => {
    res.render('instructor/courses/create', {
        layout: 'layouts/dashboard',
        title: 'Create Course',
        path: req.originalUrl,
        user: req.user,
        sidebarPartial: '../partials/sidebar-instructor'
    });
});

// Course Editor
router.get('/courses/:id/edit', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id }
        });

        if (!course || course.instructorId !== req.user.id) {
            return res.status(404).send('Course not found');
        }

        res.render('instructor/courses/edit', {
            layout: 'layouts/dashboard',
            title: `Edit: ${course.title}`,
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            course
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Instructor Analytics
router.get('/analytics', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
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

        res.render('instructor/analytics', {
            layout: 'layouts/dashboard',
            title: 'Analytics',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            analytics
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.get('/earnings', async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            where: { status: 'COMPLETED' },
            include: {
                enrollments: { include: { course: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        let totalEarnings = 0;
        let recentTransactions = [];

        payments.forEach(p => {
            if (p.enrollments && p.enrollments.length > 0 && p.enrollments[0].course) {
                if (p.enrollments[0].course.instructorId === req.user.id) {
                    // Instructor takes 90%
                    const payout = p.amount * 0.90;
                    totalEarnings += payout;
                    recentTransactions.push({
                        course: p.enrollments[0].course.title,
                        date: p.createdAt.toLocaleDateString(),
                        amount: payout
                    });
                }
            }
        });

        res.render('instructor/earnings', {
            layout: 'layouts/dashboard',
            title: 'Earnings',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            earnings: { totalEarnings, recentTransactions }
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

    // Share the same view as student since features are identical
    res.render('student/privacy', {
        title: 'Privacy & Data',
        path: '/instructor/privacy',
        consent
    });
});

router.post('/privacy/consent', async (req, res) => {
    try {
        const { preferences } = req.body;
        if (!preferences) return res.status(400).json({ success: false, message: 'Preferences required' });
        
        for (const [key, val] of Object.entries(preferences)) {
            await prisma.consentLog.create({
                data: {
                    userId: req.user.id,
                    type: key,
                    accepted: val === true || val === 'true',
                    ipAddress: req.ip || '0.0.0.0',
                    userAgent: req.headers['user-agent'] || 'Unknown'
                }
            });
        }
        res.json({ success: true, message: 'Consent updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
