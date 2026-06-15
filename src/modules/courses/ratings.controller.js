const prisma = require('../../config/database');

exports.submitRating = async (req, res) => {
    try {
        const { courseId, rating, review } = req.body;
        const userId = req.user.id;

        // Ensure user is enrolled
        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } }
        });

        if (!enrollment) {
            return res.status(403).json({ success: false, message: 'Must be enrolled to review' });
        }

        const courseRating = await prisma.courseRating.upsert({
            where: { userId_courseId: { userId, courseId } },
            update: { rating: parseInt(rating), review },
            create: { userId, courseId, rating: parseInt(rating), review }
        });

        res.json({ success: true, data: courseRating });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCourseRatings = async (req, res) => {
    try {
        const { courseId } = req.params;
        const ratings = await prisma.courseRating.findMany({
            where: { courseId },
            include: { user: { select: { name: true, avatar: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: ratings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
