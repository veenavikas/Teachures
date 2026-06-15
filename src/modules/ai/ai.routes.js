const express = require('express');
const router = express.Router();
const aiController = require('./ai.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

router.post('/chat', requireAuth, aiController.askTutor);

module.exports = router;
