const prisma = require('../../config/database');

// --- INSTRUCTOR ENDPOINTS ---

exports.createAssignment = async (req, res) => {
    try {
        const { lessonId, title, description, deadline } = req.body;
        
        // Ensure the instructor owns the course this lesson belongs to
        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { section: { include: { course: true } } }
        });

        if (!lesson || lesson.section.course.instructorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const assignment = await prisma.assignment.create({
            data: {
                lessonId,
                title,
                description,
                deadline: deadline ? new Date(deadline) : null
            }
        });

        // Update lesson type to ASSIGNMENT
        await prisma.lesson.update({
            where: { id: lessonId },
            data: { type: 'ASSIGNMENT' }
        });

        res.status(201).json({ success: true, data: assignment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.gradeSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { grade, feedback, status } = req.body;

        const submission = await prisma.assignmentSubmission.findUnique({
            where: { id: submissionId },
            include: { assignment: { include: { lesson: { include: { section: { include: { course: true } } } } } } }
        });

        if (!submission || submission.assignment.lesson.section.course.instructorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const updated = await prisma.assignmentSubmission.update({
            where: { id: submissionId },
            data: { grade, feedback, status } // status: GRADED or REJECTED
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAssignmentSubmissions = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const submissions = await prisma.assignmentSubmission.findMany({
            where: { assignmentId },
            include: { user: { select: { id: true, name: true, email: true } } }
        });
        res.json({ success: true, data: submissions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- STUDENT ENDPOINTS ---

exports.submitAssignment = async (req, res) => {
    try {
        const { assignmentId, fileUrl } = req.body;

        // Check if student is enrolled in the course
        const assignment = await prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: { lesson: { include: { section: true } } }
        });

        if (!assignment) return res.status(404).json({ success: false, message: 'Not found' });

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId: assignment.lesson.section.courseId } }
        });

        if (!enrollment) return res.status(403).json({ success: false, message: 'Not enrolled' });

        const submission = await prisma.assignmentSubmission.upsert({
            where: {
                assignmentId_userId: { assignmentId, userId: req.user.id }
            },
            update: { fileUrl, status: 'PENDING', submittedAt: new Date() },
            create: { assignmentId, userId: req.user.id, fileUrl, status: 'PENDING' }
        });

        res.json({ success: true, data: submission });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
