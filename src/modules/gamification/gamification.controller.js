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
        // Simple aggregate: sum of badge points per user
        // Due to prisma limitations with summing relational data directly without group by easily,
        // we fetch and map or use raw query. For MVP, we'll fetch UserBadges.

        const users = await prisma.user.findMany({
            where: { role: 'LEARNER' },
            select: {
                id: true,
                name: true,
                avatar: true,
                badges: {
                    select: {
                        badge: {
                            select: { points: true }
                        }
                    }
                }
            }
        });

        // Calculate points
        const leaderboard = users.map(user => {
            const points = user.badges.reduce((sum, ub) => sum + ub.badge.points, 0);
            return {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                points
            };
        });

        // Sort descending by points, limit to top 10
        leaderboard.sort((a, b) => b.points - a.points);
        const top10 = leaderboard.slice(0, 10);

        res.json({ success: true, data: top10 });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
