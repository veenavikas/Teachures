const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');

router.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

// Admin Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const stats = {
            totalUsers: await prisma.user.count(),
            platformMRR: 8500,
            totalCourses: await prisma.course.count(),
            newCoursesThisWeek: 4,
            openTickets: 12
        };

        const recentEnrollments = [
            { userName: 'John Doe', courseTitle: 'Advanced Node', date: '2023-11-01', amount: 49, status: 'Completed' },
            { userName: 'Sarah Smith', courseTitle: 'React Basics', date: '2023-10-31', amount: 29, status: 'Completed' }
        ];

        res.render('admin/dashboard', {
            layout: 'layouts/dashboard',
            title: 'Admin Dashboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-admin',
            stats,
            recentEnrollments
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

module.exports = router;
