const prisma = require('../../config/database');

exports.createCohort = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { name, startDate, endDate, capacity } = req.body;

        // Ensure owner
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.instructorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
            return res.status(400).json({ success: false, message: 'Valid start date is required' });
        }

        const cohort = await prisma.cohort.create({
            data: {
                courseId,
                name,
                startDate: start,
                endDate: endDate ? new Date(endDate) : null,
                capacity: capacity ? parseInt(capacity) : null
            }
        });

        res.status(201).json({ success: true, data: cohort });
    } catch (error) {
        console.error('Create Cohort Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getCohorts = async (req, res) => {
    try {
        const { courseId } = req.params;
        const cohorts = await prisma.cohort.findMany({
            where: { courseId },
            include: { _count: { select: { enrollments: true } } },
            orderBy: { startDate: 'asc' }
        });

        res.json({ success: true, data: cohorts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteCohort = async (req, res) => {
    try {
        const { courseId, cohortId } = req.params;
        
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.instructorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await prisma.cohort.delete({ where: { id: cohortId } });
        res.json({ success: true, message: 'Cohort deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
