const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const { sendWelcomeEmail, sendOtpEmail } = require('../../services/email.service');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Generate JWT and Refresh Token
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { id: user.id, role: user.role, tenantId: user.tenantId },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
    );

    const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
    );

    return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
    try {
        const { email, password, name, role, skills, experience, phone, address } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            // If it's a form submission, redirect back with error
            if (req.accepts('html') && req.method === 'POST' && !req.headers['x-requested-with']) {
                return res.redirect('/register?error=email_taken');
            }
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const verifyToken = crypto.randomBytes(32).toString('hex');
        const verifyEmailExpires = new Date(Date.now() + 86400000); // 24 hours
        
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 15 * 60000); // 15 mins

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                phone,
                address,
                role: role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'STUDENT',
                verifyEmailToken: verifyToken,
                verifyEmailExpires,
                otpCode,
                otpExpires
            }
        });
        
        console.log(`[OTP] Generated OTP for ${email}: ${otpCode}`);

        if (user.role === 'INSTRUCTOR') {
            let expertiseArray = [];
            if (skills) {
                expertiseArray = skills.split(',').map(s => s.trim()).filter(s => s);
            }
            await prisma.instructorProfile.create({ 
                data: { 
                    userId: user.id,
                    expertise: expertiseArray,
                    bio: experience || null
                } 
            });
        }

        // Do not auto-login if it's an unapproved instructor
        if (user.role === 'INSTRUCTOR') {
            const isApiCall = req.headers['content-type'] === 'application/json' || req.headers['x-requested-with'];
            if (!isApiCall) {
                return res.redirect('/login?error=instructor_pending');
            }
            return res.status(201).json({
                success: true,
                message: 'Instructor registration successful. Pending admin approval.',
                data: { user: { id: user.id, name: user.name, email: user.email, role: user.role } }
            });
        }

        // Set a temporary auth token for the OTP step
        const tempAuthToken = jwt.sign({ id: user.id, intent: 'OTP' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
        res.cookie('tempAuthToken', tempAuthToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });

        sendWelcomeEmail(user.email, user.name).catch(err => console.error('Welcome email failed:', err));
        sendOtpEmail(user.email, user.name, otpCode).catch(err => console.error('OTP email failed:', err));

        const isApiCall = req.headers['content-type'] === 'application/json' || req.headers['x-requested-with'];
        if (!isApiCall) {
            return res.redirect(`/verify-otp`);
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful. OTP sent to email.',
            requiresOTP: true
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
            if (req.accepts('html') && !req.headers['x-requested-with']) {
                return res.redirect('/login?error=invalid_credentials');
            }
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            if (req.accepts('html') && !req.headers['x-requested-with']) {
                return res.redirect('/login?error=invalid_credentials');
            }
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (user.role === 'INSTRUCTOR') {
            const profile = await prisma.instructorProfile.findUnique({ where: { userId: user.id } });
            if (profile && !profile.isApproved) {
                if (req.accepts('html') && !req.headers['x-requested-with']) {
                    return res.redirect('/login?error=instructor_pending');
                }
                return res.status(403).json({ success: false, message: 'Instructor account pending admin approval.' });
            }
        }

        // Unverified User (DEV-003)
        if (!user.isVerified) {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = new Date(Date.now() + 15 * 60000);
            await prisma.user.update({
                where: { id: user.id },
                data: { otpCode, otpExpires }
            });
            console.log(`[OTP] Generated OTP for ${email}: ${otpCode}`);
            
            const tempAuthToken = jwt.sign({ id: user.id, intent: 'OTP' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
            res.cookie('tempAuthToken', tempAuthToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });

            if (req.accepts('html') && !req.headers['x-requested-with']) {
                return res.redirect(`/verify-otp`);
            }
            return res.status(403).json({ success: false, message: 'Account not verified. Please verify OTP.', requiresOTP: true });
        }

        // 2FA Verification during Login
        if (user.twoFactorEnabled) {
            const tempAuthToken = jwt.sign({ id: user.id, intent: 'MFA' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
            res.cookie('tempAuthToken', tempAuthToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });
            
            if (req.accepts('html') && !req.headers['x-requested-with']) {
                return res.redirect(`/mfa-challenge`);
            }
            return res.status(200).json({ success: true, requires2FA: true });
        }

        const tokens = generateTokens(user);

        // Set accessToken cookie so browser page routes work immediately
        res.cookie('accessToken', tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // For browser form submissions, redirect to the correct dashboard
        const isApiCall = req.headers['content-type'] === 'application/json' || req.headers['x-requested-with'];
        if (!isApiCall) {
            const next = req.query.returnTo || req.query.next || null;
            const dashboard = next || (user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : user.role === 'ADMINISTRATOR' ? '/admin/dashboard' : '/student/dashboard');
            return res.redirect(dashboard);
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken: tokens.accessToken }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error during login', error: error.message });
    }
};

// 2FA Setup endpoints
exports.setup2FA = async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({ name: 'Teachures' });
        
        await prisma.user.update({
            where: { id: req.user.id },
            data: { twoFactorSecret: secret.base32 }
        });

        const dataUrl = await QRCode.toDataURL(secret.otpauth_url);
        
        res.json({ success: true, qrCode: dataUrl, secret: secret.base32 });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error setting up 2FA' });
    }
};

exports.verify2FASetup = async (req, res) => {
    try {
        const { token } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (verified) {
            await prisma.user.update({
                where: { id: user.id },
                data: { twoFactorEnabled: true }
            });
            res.json({ success: true, message: '2FA enabled successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid token' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error verifying 2FA' });
    }
};

exports.refresh = async (req, res) => {
    try {
        // Basic implementation: grab from cookies or body depending on setup
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token required' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        const tokens = generateTokens(user);

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(200).json({
            success: true,
            accessToken: tokens.accessToken
        });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Refresh token expired' });
        }
        res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
};

exports.logout = async (req, res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    // Always redirect to home for browser clients
    if (req.accepts('html') && !req.headers['x-requested-with']) {
        return res.redirect('/');
    }
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};

const crypto = require('crypto');
const { sendForgotPasswordEmail, sendResetSuccessEmail, sendVerifyEmail } = require('../../services/email.service');

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        
        const isHtml = req.accepts('html') && !req.headers['x-requested-with'];
        
        if (!user) {
            if (isHtml) return res.redirect('/forgot-password?success=true');
            return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: { resetPasswordToken: resetToken, resetPasswordExpires }
        });

        await sendForgotPasswordEmail(user.email, user.name, resetToken).catch(e => console.error(e));

        if (isHtml) return res.redirect('/forgot-password?success=true');
        res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        if (req.accepts('html') && !req.headers['x-requested-with']) return res.redirect('/forgot-password?error=server_error');
        res.status(500).json({ success: false, message: 'Error processing request.' });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password, newPassword } = req.body;
        const targetPassword = password || newPassword;

        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: { gt: new Date() }
            }
        });

        const isHtml = req.accepts('html') && !req.headers['x-requested-with'];

        if (!user) {
            if (isHtml) return res.redirect(`/reset-password?token=${token}&error=invalid_token`);
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(targetPassword, salt);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        if (isHtml) return res.redirect('/login?success=password_reset');
        res.json({ success: true, message: 'Password successfully reset.' });
    } catch (error) {
        console.error('Reset password error:', error);
        if (req.accepts('html') && !req.headers['x-requested-with']) return res.redirect(`/reset-password?token=${req.body.token}&error=server_error`);
        res.status(500).json({ success: false, message: 'Error resetting password.' });
    }
};

exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                verifyEmailToken: token,
                verifyEmailExpires: { gt: new Date() }
            }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification token.' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verifyEmailToken: null,
                verifyEmailExpires: null
            }
        });

        res.json({ success: true, message: 'Email successfully verified.' });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ success: false, message: 'Error verifying email.' });
    }
};

exports.verifyOTP = async (req, res) => {
    try {
        const tempToken = req.cookies.tempAuthToken;
        if (!tempToken) return res.status(401).json({ success: false, message: 'Session expired' });
        
        const decoded = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET);
        if (decoded.intent !== 'OTP') return res.status(400).json({ success: false, message: 'Invalid token intent' });

        const { otpCode } = req.body;
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        
        if (!user || user.otpCode !== otpCode || user.otpExpires < new Date()) {
            if (req.accepts('html') && !req.headers['x-requested-with']) {
                return res.redirect(`/verify-otp?error=invalid_code`);
            }
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
        
        await prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true, otpCode: null, otpExpires: null }
        });
        
        // After verifying OTP, check if they have 2FA enabled
        if (user.twoFactorEnabled) {
            const mfaToken = jwt.sign({ id: user.id, intent: 'MFA' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
            res.cookie('tempAuthToken', mfaToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });
            if (req.accepts('html') && !req.headers['x-requested-with']) {
                return res.redirect(`/mfa-challenge`);
            }
            return res.status(200).json({ success: true, requires2FA: true });
        }
        
        res.clearCookie('tempAuthToken');
        const tokens = generateTokens(user);
        res.cookie('accessToken', tokens.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
        
        if (req.accepts('html') && !req.headers['x-requested-with']) {
            const dashboard = user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : user.role === 'ADMINISTRATOR' ? '/admin/dashboard' : '/student/dashboard';
            return res.redirect(dashboard);
        }
        return res.status(200).json({ success: true, message: 'OTP verified successfully', data: { user: { id: user.id, name: user.name, role: user.role, email: user.email }, accessToken: tokens.accessToken } });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.verifyMFA = async (req, res) => {
    try {
        const tempToken = req.cookies.tempAuthToken;
        if (!tempToken) return res.status(401).json({ success: false, message: 'Session expired' });
        
        const decoded = jwt.verify(tempToken, process.env.JWT_ACCESS_SECRET);
        if (decoded.intent !== 'MFA') return res.status(400).json({ success: false, message: 'Invalid token intent' });

        const { twoFactorCode } = req.body;
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: twoFactorCode
        });

        if (!verified) {
            if (req.accepts('html') && !req.headers['x-requested-with']) {
                return res.redirect(`/mfa-challenge?error=invalid_code`);
            }
            return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
        }
        
        res.clearCookie('tempAuthToken');
        const tokens = generateTokens(user);
        res.cookie('accessToken', tokens.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });
        res.cookie('refreshToken', tokens.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
        
        if (req.accepts('html') && !req.headers['x-requested-with']) {
            const dashboard = user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : user.role === 'ADMINISTRATOR' ? '/admin/dashboard' : '/student/dashboard';
            return res.redirect(dashboard);
        }
        return res.status(200).json({ success: true, message: 'MFA verified successfully', data: { user: { id: user.id, name: user.name, role: user.role, email: user.email }, accessToken: tokens.accessToken } });
    } catch (error) {
        console.error('Verify MFA error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

