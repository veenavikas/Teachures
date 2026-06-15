const express = require('express');
const router = express.Router();
const cmsController = require('./cms.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');

// --- PUBLIC ROUTES ---
router.get('/public/:slug', cmsController.getPublicPageBySlug);

// --- ADMIN ROUTES ---
router.use(requireAuth, requireRole('ADMINISTRATOR'));

router.get('/', cmsController.getAllPages);
router.get('/:id', cmsController.getPageById);
router.post('/', cmsController.createPage);
router.put('/:id', cmsController.updatePage);
router.delete('/:id', cmsController.deletePage);

module.exports = router;
