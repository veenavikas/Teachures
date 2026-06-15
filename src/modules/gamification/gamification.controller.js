const prisma = require('../../config/database');

// --- ADMIN ---

exports.createBadge = async (req, res) => {
    try {
        const { name, description, iconUrl, condition, points } = req.body;
        const badge = await prisma.badge.create({
            data: {
                name,
                description,
                iconUrl: iconUrl || 'award', // Lucide icon name fallback
                condition,
                points: parseInt(points) || 10
            }
        });
        res.status(201).json({ success: true, data: badge });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateBadge = async (req, res) => {
    try {
        const { name, description, iconUrl, condition, points } = req.body;
        const badge = await prisma.badge.update({
            where: { id: req.params.id },
            data: {
                name,
                description,
                iconUrl,
                condition,
                points: points ? parseInt(points) : undefined
            }
        });
        res.json({ success: true, data: badge });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteBadge = async (req, res) => {
    try {
        await prisma.badge.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Badge deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const { createNotification } = require('../notifications/notifications.controller');

exports.getAllBadges = async (req, res) => {
    try {
        const badges = await prisma.badge.findMany();
        res.json({ success: true, data: badges });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- UTILITIES FOR POINTS & BADGES ---

exports.awardPoints = async (userId, amount) => {
    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { totalPoints: { increment: amount } }
        });
        await this.checkAndAwardBadges(userId);
        return user.totalPoints;
    } catch (error) {
        console.error('Failed to award points:', error);
    }
};

exports.checkAndAwardBadges = async (userId) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { badges: true, quizAttempts: true, progress: true }
        });

        const availableBadges = await prisma.badge.findMany();

        for (const badge of availableBadges) {
            const hasBadge = user.badges.find(b => b.badgeId === badge.id);
            if (!hasBadge) {
                let shouldAward = false;

                // Example logic based on conditions
                if (badge.condition === 'first_quiz_passed' && user.quizAttempts.some(q => q.passed)) {
                    shouldAward = true;
                } else if (badge.condition === '100_points' && user.totalPoints >= 100) {
                    shouldAward = true;
                }

                if (shouldAward) {
                    await prisma.userBadge.create({
                        data: { userId, badgeId: badge.id }
                    });
                    await createNotification(userId, 'New Badge Unlocked! 🏆', `You earned the "${badge.name}" badge.`, '/student/profile');
                }
            }
        }
    } catch (error) {
        console.error('Failed to check and award badges:', error);
    }
};

exports.getMyBadges = async (req, res) => {
    try {
        const userBadges = await prisma.userBadge.findMany({
            where: { userId: req.user.id },
            include: { badge: true }
        });
        res.json({ success: true, data: userBadges });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: {
                id: true,
                name: true,
                avatar: true,
                totalPoints: true
            },
            orderBy: { totalPoints: 'desc' },
            take: 10
        });

        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
