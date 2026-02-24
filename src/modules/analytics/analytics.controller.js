const prisma = require('../../config/database');

// --- TRAINER ---

exports.getTrainerOverview = async (req, res) => {
    try {
        const trainerId = req.user.id;

        // Sum revenue from payments linked to trainer's courses
        // Note: For MVP, we'll do a simple approximation by getting courses, then enrollments

        const courses = await prisma.course.findMany({
            where: { trainerId },
            include: {
                _count: {
                    select: { enrollments: true, ratings: true }
                },
                ratings: { select: { rating: true } }
            }
        });

        let totalStudents = 0;
        let totalRevenue = 0;
        let totalRatingSum = 0;
        let ratingCount = 0;

        for (const course of courses) {
            totalStudents += course._count.enrollments;
            totalRevenue += course._count.enrollments * course.price; // Approximation assuming full price paid

            for (const r of course.ratings) {
                totalRatingSum += r.rating;
                ratingCount++;
            }
        }

        const avgRating = ratingCount > 0 ? (totalRatingSum / ratingCount).toFixed(1) : 0;

        res.json({
            success: true,
            data: {
                totalCourses: courses.length,
                totalStudents,
                totalRevenue,
                avgRating
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCourseAnalytics = async (req, res) => {
    try {
        const { courseId } = req.params;

        // Ensure trainer owns course
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.trainerId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const enrollments = await prisma.enrollment.findMany({
            where: { courseId },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { enrolledAt: 'desc' },
            take: 20
        });

        // Get progress stats
        const progressStats = await prisma.courseProgress.findMany({
            where: { courseId }
        });

        const completedCount = progressStats.filter(p => p.percentComplete >= 100).length;
        const avgCompletion = progressStats.length > 0
            ? progressStats.reduce((sum, p) => sum + p.percentComplete, 0) / progressStats.length
            : 0;

        res.json({
            success: true,
            data: {
                totalEnrollments: progressStats.length,
                completedCount,
                avgCompletion: Math.round(avgCompletion),
                recentEnrollments: enrollments
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- ADMIN ---

exports.getPlatformAnalytics = async (req, res) => {
    try {
        const totalUsers = await prisma.user.count();
        const totalTrainers = await prisma.user.count({ where: { role: 'TRAINER' } });
        const totalCourses = await prisma.course.count();
        const totalEnrollments = await prisma.enrollment.count();

        // Count new users this month
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const newUsers = await prisma.user.count({
            where: { createdAt: { gte: thirtyDaysAgo } }
        });

        res.json({
            success: true,
            data: {
                totalUsers,
                totalTrainers,
                totalCourses,
                totalEnrollments,
                newUsersLast30Days: newUsers
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getRevenueAnalytics = async (req, res) => {
    try {
        // Aggregate completed payments
        const payments = await prisma.payment.findMany({
            where: { status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' }
        });

        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

        // Group by month for chart data (simple example)
        res.json({
            success: true,
            data: {
                totalRevenue,
                totalTransactions: payments.length,
                recentTransactions: payments.slice(0, 10)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}
