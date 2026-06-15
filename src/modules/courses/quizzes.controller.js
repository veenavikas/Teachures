const prisma = require('../../config/database');

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
                questions: {
                    create: questions.map((q, index) => ({
                        text: q.text,
                        type: q.type || 'MCQ',
                        options: q.options, // Should be array of objects: [{id: 1, text: 'A', isCorrect: true}]
                        order: index,
                        points: q.points || 1
                    }))
                }
            },
            include: { questions: true }
        });

        res.status(201).json({ success: true, data: quiz });
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

        let totalPoints = 0;
        let earnedPoints = 0;

        quiz.questions.forEach(q => {
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
