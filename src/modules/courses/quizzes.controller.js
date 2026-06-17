const prisma = require('../../config/database');
const { checkAndAwardBadge } = require('../gamification/badges.controller');

// ─── INSTRUCTOR METHODS ────────────────────────────────────────

exports.createQuiz = async (req, res) => {
    try {
        const { lessonId, title, passingScore, timeLimit, questions } = req.body;
        
        // Ensure lesson exists and belongs to instructor's course
        const lesson = await prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { section: { include: { course: true } } }
        });

        if (!lesson || lesson.section.course.instructorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const quiz = await prisma.quiz.create({
            data: {
                lessonId,
                title,
                passingScore: parseInt(passingScore) || 70,
                timeLimit: parseInt(timeLimit) || null,
                pullRandomCount: req.body.pullRandomCount ? parseInt(req.body.pullRandomCount) : null,
                questions: questions && questions.length > 0 ? {
                    create: questions.map((q, index) => ({
                        text: q.text,
                        type: q.type || 'MCQ',
                        options: q.options, // Should be array of objects: [{id: 1, text: 'A', isCorrect: true}]
                        order: index,
                        points: q.points || 1
                    }))
                } : undefined
            },
            include: { questions: true }
        });

        res.status(201).json({ success: true, data: quiz });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addBankQuestion = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { text, type, options, points } = req.body;

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.instructorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const question = await prisma.question.create({
            data: {
                courseId,
                text,
                type: type || 'MCQ',
                options: options || [],
                order: 0,
                points: parseInt(points) || 1
            }
        });

        res.status(201).json({ success: true, data: question });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBankQuestions = async (req, res) => {
    try {
        const { courseId } = req.params;
        const questions = await prisma.question.findMany({
            where: { courseId },
            orderBy: { id: 'asc' }
        });
        res.json({ success: true, data: questions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteBankQuestion = async (req, res) => {
    try {
        const { courseId, questionId } = req.params;
        
        // ensure owner
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course || course.instructorId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await prisma.question.delete({ where: { id: questionId } });
        res.json({ success: true, message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─── STUDENT METHODS ───────────────────────────────────────────

exports.submitQuiz = async (req, res) => {
    try {
        const { quizId, answers } = req.body; // answers: { [questionId]: selectedOptionId }
        const userId = req.user.id;

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true }
        });

        if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

        const attemptCount = await prisma.quizAttempt.count({
            where: { quizId, userId }
        });

        if (attemptCount >= quiz.maxAttempts) {
            return res.status(400).json({ success: false, message: `Maximum attempts (${quiz.maxAttempts}) reached.` });
        }

        let quizQuestions = quiz.questions;
        if (quiz.pullRandomCount && quiz.pullRandomCount > 0) {
            const answerIds = Object.keys(answers);
            quizQuestions = await prisma.question.findMany({
                where: { id: { in: answerIds } }
            });
        }

        let totalPoints = 0;
        let earnedPoints = 0;

        quizQuestions.forEach(q => {
            totalPoints += q.points;
            const selectedOptionId = answers[q.id];
            
            // Parse options array from JSON
            const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            const correctOption = options.find(opt => opt.isCorrect === true);

            if (correctOption && selectedOptionId === correctOption.id) {
                earnedPoints += q.points;
            }
        });

        const scorePercentage = (earnedPoints / totalPoints) * 100;
        const passed = scorePercentage >= quiz.passingScore;

        const attempt = await prisma.quizAttempt.create({
            data: {
                userId,
                quizId,
                answers,
                score: scorePercentage,
                passed
            }
        });

        if (passed) {
            const previousPassCount = await prisma.quizAttempt.count({
                where: { quizId, userId, passed: true, id: { not: attempt.id } }
            });
            if (previousPassCount === 0) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { totalPoints: { increment: quiz.pointsAwarded } }
                });
            }
        }

        // Award Badges
        if (scorePercentage === 100) {
            await checkAndAwardBadge(userId, 'quiz_100_percent');
        }

        res.status(200).json({
            success: true,
            data: {
                score: scorePercentage,
                passed,
                attempt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
