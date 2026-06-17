const prisma = require('../../config/database');
const { createNotification } = require('../notifications/notifications.controller');

/**
 * Checks and awards badges to a user based on specific conditions.
 * @param {String} userId - The ID of the user.
 * @param {String} condition - The condition identifier (e.g., 'quiz_100_percent', 'complete_1_course').
 */
async function checkAndAwardBadge(userId, condition) {
    try {
        // Find the badge associated with this condition
        const badge = await prisma.badge.findFirst({
            where: { condition }
        });

        if (!badge) return false;

        // Check if user already has this badge
        const existingUserBadge = await prisma.userBadge.findUnique({
            where: {
                userId_badgeId: {
                    userId: userId,
                    badgeId: badge.id
                }
            }
        });

        if (existingUserBadge) return false; // Already awarded

        // Award the badge
        await prisma.$transaction([
            prisma.userBadge.create({
                data: {
                    userId,
                    badgeId: badge.id
                }
            }),
            prisma.user.update({
                where: { id: userId },
                data: {
                    totalPoints: {
                        increment: badge.points
                    }
                }
            })
        ]);

        // Create a notification for the user
        await createNotification(
            userId,
            'New Badge Earned! 🏆',
            `Congratulations! You earned the "${badge.name}" badge and +${badge.points} XP.`,
            '/student/dashboard'
        );

        return true;
    } catch (error) {
        console.error('Error awarding badge:', error);
        return false;
    }
}

module.exports = {
    checkAndAwardBadge
};
