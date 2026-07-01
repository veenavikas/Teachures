const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const supabase = require('../../config/supabase');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// 2FA Endpoints
router.post('/2fa/setup', requireAuth, authController.setup2FA);
router.post('/2fa/verify', requireAuth, authController.verify2FASetup);
router.post('/verify-otp', authController.verifyOTP);
router.post('/verify-mfa', authController.verifyMFA);

// Supabase OAuth Initiation
router.get('/google', async (req, res) => {
    const role = req.query.role || 'STUDENT';
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${process.env.APP_URL}/api/v1/auth/supabase/callback?role=${role}`
        }
    });

    if (error) {
        return res.redirect('/login?error=supabase_auth_failed');
    }

    res.redirect(data.url);
});

// Supabase OAuth Callback
router.get('/supabase/callback', async (req, res) => {
    const code = req.query.code;
    const requestedRole = req.query.role || 'STUDENT';

    if (!code) return res.redirect('/login?error=missing_code');

    try {
        // Exchange code for Supabase session
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
        if (sessionError) throw sessionError;

        // Fetch User Info
        const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser(sessionData.session.access_token);
        if (userError) throw userError;

        const email = supabaseUser.email;
        const name = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || email.split('@')[0];
        const avatar = supabaseUser.user_metadata?.avatar_url || null;
        const provider = supabaseUser.app_metadata?.provider || 'google';

        const prisma = require('../../config/database');
        
        // Find or create local user
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email,
                    name,
                    oauthProvider: provider,
                    oauthId: supabaseUser.id,
                    avatar,
                    role: requestedRole,
                    isVerified: true
                }
            });

            if (user.role === 'INSTRUCTOR') {
                await prisma.instructorProfile.create({ 
                    data: { 
                        userId: user.id,
                        expertise: [],
                        bio: null
                    } 
                });
            }
        }

        // Generate local JWTs
        const jwt = require('jsonwebtoken');
        const accessToken = jwt.sign({ id: user.id, role: user.role, tenantId: user.tenantId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Redirect to dashboard based on role
        const dashboard = user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : user.role === 'ADMINISTRATOR' ? '/admin/dashboard' : '/student/dashboard';
        res.redirect(dashboard);

    } catch (error) {
        console.error('Supabase OAuth Error:', error.message);
        res.redirect('/login?error=oauth_failed');
    }
});

// Password Recovery & Email Verification
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);

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
router.post('/profile/password', requireAuth, profileController.updatePassword);

module.exports = router;
