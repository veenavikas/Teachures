const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

router.post('/chat', aiController.askTutor);
router.post('/generate-curriculum', requireAuth, aiController.generateCurriculum);
router.post('/generate-quiz', requireAuth, aiController.generateQuiz);

module.exports = router;
