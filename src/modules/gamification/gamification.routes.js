const express = require('express');
const router = express.Router();
const gamificationController = require('./gamification.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

router.use(requireAuth);

// --- ADMIN ROUTES ---
router.post('/badges', requireRole('ADMIN'), gamificationController.createBadge);
router.put('/badges/:id', requireRole('ADMIN'), gamificationController.updateBadge);
router.delete('/badges/:id', requireRole('ADMIN'), gamificationController.deleteBadge);

// --- LEARNER ROUTES ---
// Get all available badges
router.get('/badges', gamificationController.getAllBadges);

// Get badges earned by current user
router.get('/my-badges', requireRole('LEARNER'), gamificationController.getMyBadges);

// Leaderboard
router.get('/leaderboard', gamificationController.getLeaderboard);

module.exports = router;
