const express = require('express');
const router = express.Router();
const notificationsController = require('./notifications.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

// All notifications routes require user authentication
router.use(requireAuth);

router.get('/', notificationsController.getMyNotifications);
router.post('/:id/read', notificationsController.markAsRead);
router.post('/read-all', notificationsController.markAllAsRead);

module.exports = router;
