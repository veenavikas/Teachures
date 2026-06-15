const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

router.use(requireAuth);

// --- INSTRUCTOR ROUTES ---
router.get('/instructor/overview', requireRole('INSTRUCTOR'), analyticsController.getInstructorOverview);
router.get('/instructor/courses/:courseId', requireRole('INSTRUCTOR'), analyticsController.getCourseAnalytics);

// --- ADMIN ROUTES ---
router.get('/wp-admin/platform', requireRole('ADMINISTRATOR'), analyticsController.getPlatformAnalytics);
router.get('/wp-admin/revenue', requireRole('ADMINISTRATOR'), analyticsController.getRevenueAnalytics);

module.exports = router;
