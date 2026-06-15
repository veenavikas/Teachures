const express = require('express');
const router = express.Router();
const supportController = require('./support.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

// All support routes require authentication
router.use(requireAuth);

// Get my tickets
router.get('/', supportController.getMyTickets);

// Get specific ticket and its messages
router.get('/:id', supportController.getTicket);

// Create a new support ticket
router.post('/', supportController.createTicket);

// Add a message to an existing ticket
router.post('/:id/messages', supportController.addMessage);

// Admin / Instructor actions
router.put('/:id/status', requireRole('ADMINISTRATOR', 'INSTRUCTOR'), supportController.updateTicketStatus);

module.exports = router;
