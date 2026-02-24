const express = require('express');
const router = express.Router();
const quizzesController = require('./quizzes.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

// Public - No public quiz access right now. Must be enrolled.

router.use(requireAuth);

// --- TRAINER ROUTES ---
router.post('/lessons/:lessonId/quiz', requireRole('TRAINER'), quizzesController.createQuiz);
router.put('/:id', requireRole('TRAINER'), quizzesController.updateQuiz);
router.delete('/:id', requireRole('TRAINER'), quizzesController.deleteQuiz);

router.post('/:id/questions', requireRole('TRAINER'), quizzesController.addQuestion);
router.put('/questions/:questionId', requireRole('TRAINER'), quizzesController.updateQuestion);
router.delete('/questions/:questionId', requireRole('TRAINER'), quizzesController.deleteQuestion);

// --- LEARNER ROUTES ---
// Get quiz configuration and questions (without answers if possible, but for simplicity returning all here)
router.get('/:id', requireRole('LEARNER', 'TRAINER', 'ADMIN'), quizzesController.getQuiz);

// Submit quiz attempt
router.post('/:id/attempt', requireRole('LEARNER'), quizzesController.submitAttempt);

// Get my attempts for a quiz
router.get('/:id/attempts', requireRole('LEARNER'), quizzesController.getMyAttempts);

module.exports = router;
