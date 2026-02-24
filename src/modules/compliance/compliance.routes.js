const express = require('express');
const router = express.Router();
const complianceController = require('./compliance.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

// Public - Submit cookie consent (works even for non-logged in users via IP/UserAgent)
router.post('/consent', complianceController.saveConsent);

// Protected Auth Routes
router.use(requireAuth);

// Get current logged-in user's consent preferences
router.get('/consent', complianceController.getMyConsent);

// Export all user data as JSON
router.get('/export', complianceController.exportMyData);

// Delete (Anonymize/Soft-Delete) user account
router.delete('/account', complianceController.deleteMyAccount);

module.exports = router;
