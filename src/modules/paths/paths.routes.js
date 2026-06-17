const express = require('express');
const router = express.Router();
const pathsController = require('./paths.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

// Public route to view paths (optional, depending on where they are displayed)
router.get('/', pathsController.getAllPaths);

// Protected Instructor Routes
router.post('/', requireAuth, requireRole('INSTRUCTOR', 'ADMINISTRATOR'), pathsController.createPath);
router.put('/:id', requireAuth, requireRole('INSTRUCTOR', 'ADMINISTRATOR'), pathsController.updatePath);
router.delete('/:id', requireAuth, requireRole('INSTRUCTOR', 'ADMINISTRATOR'), pathsController.deletePath);

module.exports = router;
