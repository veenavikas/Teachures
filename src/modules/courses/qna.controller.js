const prisma = require('../../config/database');

exports.postQuestion = async (req, res) => {
    try {
        const { courseId, lessonId, question, details } = req.body;
        const userId = req.user.id;

        const qna = await prisma.courseQnA.create({
            data: { courseId, lessonId, userId, question, details },
            include: { user: { select: { name: true, avatar: true } } }
        });

        res.status(201).json({ success: true, data: qna });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getQuestions = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { lessonId } = req.query;

        const whereClause = { courseId };
        if (lessonId) whereClause.lessonId = lessonId;

        const qnas = await prisma.courseQnA.findMany({
            where: whereClause,
            include: {
                user: { select: { name: true, avatar: true, role: true } },
                replies: {
                    include: { user: { select: { name: true, avatar: true, role: true } } },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: qnas });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.postReply = async (req, res) => {
    try {
        const { qnaId, answer } = req.body;
        const userId = req.user.id;

        const reply = await prisma.qnaReply.create({
            data: { qnaId, userId, answer },
            include: { user: { select: { name: true, avatar: true, role: true } } }
        });

        res.status(201).json({ success: true, data: reply });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
