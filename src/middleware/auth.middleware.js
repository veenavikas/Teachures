const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const setAccessCookie = (res, token) => {
    res.cookie('accessToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000
    });
};

/**
 * requireAuth — supports both:
 *  - Browser page routes: accessToken cookie (auto-refreshed via refreshToken cookie)
 *  - API routes: Authorization: Bearer header
 */
const requireAuth = async (req, res, next) => {
    try {
        let token = null;
        let fromCookie = false;

        // 1. Cookie first (browser page loads)
        if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
            fromCookie = true;
        }

        // 2. Authorization header fallback (API / mobile)
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        const redirectToLogin = (reason = '') => {
            res.clearCookie('accessToken');
            if (req.accepts('html')) return res.redirect('/login' + (reason ? '?error=' + reason : ''));
            return res.status(401).json({ success: false, message: 'Authentication required' });
        };

        if (!token) return redirectToLogin();

        // Try verifying access token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (err) {
            // If expired AND we came from a cookie, try silent refresh
            if (err.name === 'TokenExpiredError' && fromCookie && req.cookies.refreshToken) {
                try {
                    const refreshDecoded = jwt.verify(req.cookies.refreshToken, process.env.JWT_REFRESH_SECRET);
                    const user = await prisma.user.findUnique({ where: { id: refreshDecoded.id } });
                    if (!user) return redirectToLogin();

                    // Issue new access token
                    const newToken = jwt.sign(
                        { id: user.id, role: user.role },
                        process.env.JWT_ACCESS_SECRET,
                        { expiresIn: '15m' }
                    );
                    setAccessCookie(res, newToken);
                    req.user = user;
                    return next();
                } catch (refreshErr) {
                    return redirectToLogin('session_expired');
                }
            }
            return redirectToLogin('invalid_token');
        }

        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) return redirectToLogin();

        req.user = user;
        next();
    } catch (error) {
        if (req.accepts('html')) {
            res.clearCookie('accessToken');
            return res.redirect('/login');
        }
        return res.status(500).json({ success: false, message: 'Auth error' });
    }
};

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            if (req.accepts('html')) {
                return res.status(403).send('<h1 style="font-family:sans-serif;text-align:center;margin-top:10vh;color:#fff;background:#050505;min-height:100vh;padding-top:10vh;">403 — Access Denied. <a href="/" style="color:#F5C518;">Go Home</a></h1>');
            }
            return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

module.exports = { requireAuth, requireRole };
