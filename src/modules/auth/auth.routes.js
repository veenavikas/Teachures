const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const passport = require('passport');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// 2FA Endpoints
router.post('/2fa/setup', requireAuth, authController.setup2FA);
router.post('/2fa/verify', requireAuth, authController.verify2FASetup);

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
    (req, res) => {
        // Generate tokens for OAuth user
        const { generateTokens } = require('./auth.controller'); // Need to export generateTokens from controller or just recreate
        const jwt = require('jsonwebtoken');
        const accessToken = jwt.sign({ id: req.user.id, role: req.user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: req.user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Redirect to frontend dashboard with access token
        res.redirect(`${process.env.APP_URL}/auth/success?token=${accessToken}`);
    }
);

// To be implemented
// router.post('/forgot-password', authController.forgotPassword);
// router.post('/reset-password', authController.resetPassword);
// router.post('/verify-email', authController.verifyEmail);

const profileController = require('./profile.controller');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'src/public/uploads/avatars');
    },
    filename: function (req, file, cb) {
        cb(null, req.user.id + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Profile
router.get('/profile', requireAuth, profileController.getProfile);
router.post('/profile', requireAuth, upload.single('avatar'), profileController.updateProfile);

module.exports = router;
