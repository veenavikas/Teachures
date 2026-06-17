const prisma = require('../../config/database');
const { awardPoints } = require('../gamification/gamification.controller');

// --- INSTRUCTOR ---

exports.createQuiz = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { title, passingScore, timeLimit } = req.body;

        // Check if lesson already has a quiz
        const existing = await prisma.quiz.findUnique({ where: { lessonId } });
        if (existing) return res.status(400).json({ success: false, message: 'Lesson already has a quiz' });

        const quiz = await prisma.quiz.create({
            data: {
                lessonId,
                title,
                passingScore: passingScore ? parseInt(passingScore) : 70,
                timeLimit: timeLimit ? parseInt(timeLimit) : null
            }
        });

        res.status(201).json({ success: true, data: quiz });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateQuiz = async (req, res) => {
    try {
        const { title, passingScore, timeLimit } = req.body;
        const quiz = await prisma.quiz.update({
            where: { id: req.params.id },
            data: {
                title,
                passingScore: passingScore ? parseInt(passingScore) : undefined,
                timeLimit: timeLimit ? parseInt(timeLimit) : undefined
            }
        });
        res.json({ success: true, data: quiz });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteQuiz = async (req, res) => {
    try {
        await prisma.quiz.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Quiz deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addQuestion = async (req, res) => {
    try {
        const { text, type, options, order, points } = req.body;

        // options format: [{ id: 'a', text: 'Option A', isCorrect: true }]

        const question = await prisma.question.create({
            data: {
                quizId: req.params.id,
                text,
                type: type || 'MCQ',
                options: options || [],
                order: parseInt(order) || 0,
                points: parseInt(points) || 1
            }
        });

        res.status(201).json({ success: true, data: question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateQuestion = async (req, res) => {
    try {
        const { text, type, options, order, points } = req.body;
        const updateData = {};
        if (text) updateData.text = text;
        if (type) updateData.type = type;
        if (options) updateData.options = options;
        if (order) updateData.order = parseInt(order);
        if (points) updateData.points = parseInt(points);

        const question = await prisma.question.update({
            where: { id: req.params.questionId },
            data: updateData
        });
        res.json({ success: true, data: question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        await prisma.question.delete({ where: { id: req.params.questionId } });
        res.json({ success: true, message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// --- STUDENT ---

exports.getQuiz = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.id },
            include: {
                questions: {
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

        // In a strict environment, we'd strip 'isCorrect' from options for students here.
        // For MVP, returning full object to let frontend grade or backend grade.
        // Real implementation should only grade on backend.

        res.json({ success: true, data: quiz });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.submitAttempt = async (req, res) => {
    try {
        const quizId = req.params.id;
        const { answers } = req.body; // { questionId: selectedOptionId }

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true }
        });

        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

        const attemptsCount = await prisma.quizAttempt.count({
            where: { quizId, userId: req.user.id }
        });

        if (attemptsCount >= quiz.maxAttempts) {
            return res.status(403).json({ success: false, message: `Maximum attempts (${quiz.maxAttempts}) reached.` });
        }

        let totalPoints = 0;
        let earnedPoints = 0;

        // Backend grading
        quiz.questions.forEach(q => {
            totalPoints += q.points;
            const userAnsId = answers[q.id];
            const correctOption = q.options.find(opt => opt.isCorrect);

            if (correctOption && userAnsId === correctOption.id) {
                earnedPoints += q.points;
            }
        });

        const scorePercent = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        const passed = scorePercent >= quiz.passingScore;

        const attempt = await prisma.quizAttempt.create({
            data: {
                userId: req.user.id,
                quizId,
                answers,
                score: scorePercent,
                passed
            }
        });

        // Event Hook for Gamification (Badge check)
        if (passed) {
            // Award points for passing
            const pointsToAward = 50; 
            await awardPoints(req.user.id, pointsToAward);
        }

        res.status(201).json({
            success: true,
            data: {
                score: scorePercent,
                passed,
                earnedPoints,
                totalPoints
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMyAttempts = async (req, res) => {
    try {
        const attempts = await prisma.quizAttempt.findMany({
            where: { quizId: req.params.id, userId: req.user.id },
            orderBy: { completedAt: 'desc' }
        });
        res.json({ success: true, data: attempts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
