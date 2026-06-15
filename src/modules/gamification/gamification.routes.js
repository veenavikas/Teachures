const express = require('express');
const router = express.Router();
const gamificationController = require('./gamification.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

router.use(requireAuth);

// --- ADMIN ROUTES ---
router.post('/badges', requireRole('ADMINISTRATOR'), gamificationController.createBadge);
router.put('/badges/:id', requireRole('ADMINISTRATOR'), gamificationController.updateBadge);
router.delete('/badges/:id', requireRole('ADMINISTRATOR'), gamificationController.deleteBadge);

// --- STUDENT ROUTES ---
// Get all available badges
router.get('/badges', gamificationController.getAllBadges);

// Get badges earned by current user
router.get('/my-badges', requireRole('STUDENT'), gamificationController.getMyBadges);

// Leaderboard
router.get('/leaderboard', gamificationController.getLeaderboard);

module.exports = router;
