const prisma = require('../../config/database');

exports.getMyNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 20 // Limit to recent 20 for the dropdown
        });

        const unreadCount = await prisma.notification.count({
            where: { userId: req.user.id, isRead: false }
        });

        res.json({ success: true, data: notifications, unreadCount });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await prisma.notification.updateMany({
            where: { id, userId: req.user.id }, // Enforce ownership
            data: { isRead: true }
        });

        if (notification.count === 0) {
            return res.status(404).json({ success: false, message: 'Notification not found or unauthorized' });
        }

        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.user.id, isRead: false },
            data: { isRead: true }
        });

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Internal utility to trigger a notification from other modules
exports.createNotification = async (userId, title, message, link, type = 'SYSTEM') => {
    try {
        await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                link,
                type
            }
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};
