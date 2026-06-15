const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const { sendWelcomeEmail } = require('../../services/email.service');
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
        const { email, password, name, role } = req.body;

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

        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                name,
                role: role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'SUBSCRIBER',
            }
        });

        if (user.role === 'INSTRUCTOR') {
            await prisma.instructorProfile.create({ data: { userId: user.id } });
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

        const tokens = generateTokens(user);

        // Set both tokens as cookies
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

        sendWelcomeEmail(user.email, user.name).catch(err => console.error('Welcome email failed:', err));

        // For browser form submissions, redirect to dashboard
        const isApiCall = req.headers['content-type'] === 'application/json' || req.headers['x-requested-with'];
        if (!isApiCall) {
            const dashboard = user.role === 'ADMINISTRATOR' ? '/wp-admin/dashboard' : '/student/dashboard';
            return res.redirect(dashboard);
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken: tokens.accessToken }
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

        // 2FA Verification during Login
        if (user.twoFactorEnabled) {
            const { twoFactorCode } = req.body;
            if (!twoFactorCode) {
                if (req.accepts('html') && !req.headers['x-requested-with']) {
                    return res.redirect(`/login-2fa?email=${encodeURIComponent(user.email)}`);
                }
                return res.status(200).json({ success: true, requires2FA: true, email: user.email });
            }

            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: twoFactorCode
            });

            if (!verified) {
                if (req.accepts('html') && !req.headers['x-requested-with']) {
                    return res.redirect(`/login-2fa?email=${encodeURIComponent(user.email)}&error=invalid_code`);
                }
                return res.status(401).json({ success: false, message: 'Invalid 2FA code' });
            }
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
            const next = req.query.next || null;
            const dashboard = next || (user.role === 'INSTRUCTOR' ? '/instructor/dashboard' : user.role === 'ADMINISTRATOR' ? '/wp-admin/dashboard' : '/student/dashboard');
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

