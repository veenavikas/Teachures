const express = require('express');
const router = express.Router();
const analyticsController = require('./analytics.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

router.use(requireAuth);

// --- TRAINER ROUTES ---
router.get('/trainer/overview', requireRole('TRAINER'), analyticsController.getTrainerOverview);
router.get('/trainer/courses/:courseId', requireRole('TRAINER'), analyticsController.getCourseAnalytics);

// --- ADMIN ROUTES ---
router.get('/admin/platform', requireRole('ADMIN'), analyticsController.getPlatformAnalytics);
router.get('/admin/revenue', requireRole('ADMIN'), analyticsController.getRevenueAnalytics);

module.exports = router;
