const prisma = require('../../config/database');

exports.createPath = async (req, res) => {
    try {
        const { title, description, courseIds } = req.body;
        
        // Ensure that the courseIds provided actually belong to the current instructor
        // For an admin feature, this validation would be different.
        const validCourses = await prisma.course.findMany({
            where: {
                id: { in: courseIds },
                instructorId: req.user.id
            }
        });

        if (validCourses.length !== courseIds.length) {
            return res.status(403).json({ success: false, message: 'Some courses do not belong to you or do not exist.' });
        }

        const newPath = await prisma.learningPath.create({
            data: {
                title,
                description,
                courses: {
                    create: courseIds.map((cId, idx) => ({
                        courseId: cId,
                        order: idx
                    }))
                }
            }
        });

        res.json({ success: true, data: newPath });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePath = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, courseIds } = req.body;

        const path = await prisma.learningPath.findUnique({ where: { id } });
        if (!path) return res.status(404).json({ success: false, message: 'Path not found' });

        await prisma.learningPathCourse.deleteMany({ where: { learningPathId: id } });

        const updatedPath = await prisma.learningPath.update({
            where: { id },
            data: {
                title,
                description,
                courses: {
                    create: courseIds.map((cId, idx) => ({
                        courseId: cId,
                        order: idx
                    }))
                }
            }
        });

        res.json({ success: true, data: updatedPath });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deletePath = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.learningPathCourse.deleteMany({ where: { learningPathId: id } });
        await prisma.learningPath.delete({ where: { id } });
        res.json({ success: true, message: 'Path deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllPaths = async (req, res) => {
    try {
        const paths = await prisma.learningPath.findMany({
            include: {
                courses: {
                    orderBy: { order: 'asc' },
                    include: { course: true }
                }
            }
        });
        res.json({ success: true, data: paths });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
