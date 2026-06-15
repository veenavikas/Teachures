const express = require('express');
const router = express.Router();
const quizzesController = require('./quizzes.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

// Public - No public quiz access right now. Must be enrolled.

router.use(requireAuth);

// --- INSTRUCTOR ROUTES ---
router.post('/lessons/:lessonId/quiz', requireRole('INSTRUCTOR'), quizzesController.createQuiz);
router.put('/:id', requireRole('INSTRUCTOR'), quizzesController.updateQuiz);
router.delete('/:id', requireRole('INSTRUCTOR'), quizzesController.deleteQuiz);

router.post('/:id/questions', requireRole('INSTRUCTOR'), quizzesController.addQuestion);
router.put('/questions/:questionId', requireRole('INSTRUCTOR'), quizzesController.updateQuestion);
router.delete('/questions/:questionId', requireRole('INSTRUCTOR'), quizzesController.deleteQuestion);

// --- STUDENT ROUTES ---
// Get quiz configuration and questions (without answers if possible, but for simplicity returning all here)
router.get('/:id', requireRole('STUDENT', 'INSTRUCTOR', 'ADMINISTRATOR'), quizzesController.getQuiz);

// Submit quiz attempt
router.post('/:id/attempt', requireRole('STUDENT'), quizzesController.submitAttempt);

// Get my attempts for a quiz
router.get('/:id/attempts', requireRole('STUDENT'), quizzesController.getMyAttempts);

module.exports = router;
