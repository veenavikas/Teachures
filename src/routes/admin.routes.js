const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

router.use(requireAuth, requireRole('ADMINISTRATOR'));

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        // Compute real Platform MRR from payments in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const payments = await prisma.payment.findMany({
            where: { status: 'COMPLETED', createdAt: { gte: thirtyDaysAgo } }
        });
        const platformMRR = payments.reduce((sum, p) => sum + p.amount, 0);

        // Compute roles distribution
        const roleDistribution = await prisma.user.groupBy({
            by: ['role'],
            _count: { role: true }
        });

        // Compute recent enrollments
        const rawEnrollments = await prisma.enrollment.findMany({
            take: 5,
            orderBy: { enrolledAt: 'desc' },
            include: { user: true, course: true, payment: true }
        });
        
        const recentEnrollments = rawEnrollments.map(e => ({
            userName: e.user.name,
            courseTitle: e.course.title,
            date: e.enrolledAt.toISOString().split('T')[0],
            amount: e.payment ? e.payment.amount : 0,
            status: 'Completed'
        }));

        // Calculate revenue for the last 4 weeks
        const revenueData = [0, 0, 0, 0];
        const now = new Date();
        payments.forEach(p => {
            const diffTime = Math.abs(now - p.createdAt);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) revenueData[3] += p.amount;
            else if (diffDays <= 14) revenueData[2] += p.amount;
            else if (diffDays <= 21) revenueData[1] += p.amount;
            else if (diffDays <= 28) revenueData[0] += p.amount;
        });

        const stats = {
            totalUsers: await prisma.user.count(),
            platformMRR,
            totalCourses: await prisma.course.count(),
            newCoursesThisWeek: await prisma.course.count({ where: { createdAt: { gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) } } }),
            openTickets: await prisma.supportTicket.count({ where: { status: 'OPEN' } }),
            roleDistribution: JSON.stringify(roleDistribution.map(r => ({ label: r.role, value: r._count.role }))),
            revenueData: JSON.stringify(revenueData)
        };

        const globalLeaderboard = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            orderBy: { totalPoints: 'desc' },
            take: 10,
            select: { id: true, name: true, email: true, totalPoints: true }
        });

        res.render('admin/dashboard', {
            layout: 'layouts/dashboard',
            title: 'Admin Dashboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-admin',
            stats,
            recentEnrollments,
            globalLeaderboard
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Admin Support Ticket Management
router.get('/support', async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                user: { select: { name: true, email: true } }
            }
        });

        res.render('admin/support', {
            layout: 'layouts/dashboard',
            title: 'Support Tickets',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-admin',
            tickets
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Admin Pages CMS Management
router.get('/pages', async (req, res) => {
    try {
        const pages = await prisma.page.findMany({ orderBy: { createdAt: 'desc' } });
        res.render('admin/pages/index', {
            layout: 'layouts/dashboard',
            title: 'Manage Pages',
            path: '/admin/pages',
            user: req.user,
            sidebarPartial: '../partials/sidebar-admin',
            pages
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.get('/pages/new', (req, res) => {
    res.render('admin/pages/edit', {
        layout: 'layouts/dashboard',
        title: 'Create Page',
        path: '/admin/pages',
        user: req.user,
        sidebarPartial: '../partials/sidebar-admin',
        page: null
    });
});

router.get('/pages/:id/edit', async (req, res) => {
    try {
        const page = await prisma.page.findUnique({ where: { id: req.params.id } });
        if (!page) return res.status(404).send('Not found');
        res.render('admin/pages/edit', {
            layout: 'layouts/dashboard',
            title: 'Edit Page',
            path: '/admin/pages',
            user: req.user,
            sidebarPartial: '../partials/sidebar-admin',
            page
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// User Management
router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.render('admin/users', {
            layout: 'layouts/dashboard',
            title: 'User Management',
            path: '/admin/users',
            user: req.user,
            sidebarPartial: '../partials/sidebar-admin',
            users
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.post('/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        await prisma.user.update({
            where: { id: req.params.id },
            data: { role }
        });
        res.redirect('/admin/users');
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Content Moderation
router.get('/moderation', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { isPublished: false },
            include: { instructor: true },
            orderBy: { createdAt: 'desc' }
        });
        res.render('admin/moderation', {
            layout: 'layouts/dashboard',
            title: 'Content Moderation',
            path: '/admin/moderation',
            user: req.user,
            sidebarPartial: '../partials/sidebar-admin',
            courses
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.post('/moderation/:id/approve', async (req, res) => {
    try {
        await prisma.course.update({
            where: { id: req.params.id },
            data: { isPublished: true }
        });
        
        // Notify instructor
        const course = await prisma.course.findUnique({ where: { id: req.params.id } });
        if(course) {
            const { createNotification } = require('../modules/notifications/notifications.controller');
            await createNotification(course.instructorId, 'Course Approved! 🎉', `Your course "${course.title}" has been approved and is now live!`, `/courses/${course.slug}`);
        }
        
        res.redirect('/admin/moderation');
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Instructor Management
router.get('/instructors', async (req, res) => {
    try {
        const instructors = await prisma.user.findMany({
            where: { role: 'INSTRUCTOR' },
            include: { instructorProfile: true },
            orderBy: { createdAt: 'desc' }
        });
        res.render('admin/instructors', {
            layout: 'layouts/dashboard', title: 'Instructors', path: '/admin/instructors', user: req.user, sidebarPartial: '../partials/sidebar-admin', instructors
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.post('/instructors/:id/approve', async (req, res) => {
    try {
        await prisma.instructorProfile.update({
            where: { userId: req.params.id },
            data: { isApproved: true }
        });
        res.redirect('/admin/instructors');
    } catch (error) {
        res.status(500).send('Server Error');
    }
});
// Courses Management
router.get('/courses', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            include: { 
                instructor: { select: { name: true, email: true } },
                _count: { select: { enrollments: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.render('admin/courses', {
            layout: 'layouts/dashboard', title: 'Courses Management', path: '/admin/courses', user: req.user, sidebarPartial: '../partials/sidebar-admin', courses
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});
// Financials & Revenue
router.get('/revenue', async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            where: { status: 'COMPLETED' },
            include: {
                enrollments: { include: { course: { include: { instructor: { include: { instructorProfile: true } } } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        let grossVolume = 0;
        let platformFee = 0;
        let trainerPayouts = {};

        payments.forEach(p => {
            grossVolume += p.amount;
            
            // Assume 10% platform fee
            const fee = p.amount * 0.10;
            const payout = p.amount - fee;
            platformFee += fee;

            if (p.enrollments && p.enrollments.length > 0 && p.enrollments[0].course) {
                const instructor = p.enrollments[0].course.instructor;
                if (!trainerPayouts[instructor.id]) {
                    trainerPayouts[instructor.id] = {
                        name: instructor.name,
                        email: instructor.email,
                        paypal: instructor.instructorProfile?.paypalAccountId || 'Not setup',
                        totalOwed: 0
                    };
                }
                trainerPayouts[instructor.id].totalOwed += payout;
            }
        });

        res.render('admin/revenue', {
            layout: 'layouts/dashboard', title: 'Revenue & Payouts', path: '/admin/revenue', user: req.user, sidebarPartial: '../partials/sidebar-admin',
            financials: { grossVolume, platformFee, trainerPayouts: Object.values(trainerPayouts), payments }
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});
// Platform Settings
router.get('/settings', (req, res) => {
    // Mock settings object (in a real app, fetch from a GlobalSettings table)
    const settings = {
        platformName: 'Teachures',
        supportEmail: 'support@teachures.com',
        platformFeePercentage: 10,
        currency: 'USD',
        allowPublicRegistration: true
    };

    res.render('admin/settings', {
        layout: 'layouts/dashboard', title: 'Platform Settings', path: '/admin/settings', user: req.user, sidebarPartial: '../partials/sidebar-admin', settings
    });
});

router.post('/settings', (req, res) => {
    // In a real app, save to GlobalSettings table here.
    // For now, we mock the success response.
    res.redirect('/admin/settings?success=1');
});

module.exports = router;
