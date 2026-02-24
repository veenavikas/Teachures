const prisma = require('../../config/database');

exports.saveConsent = async (req, res) => {
    try {
        const { preferences } = req.body; // { essential: true, analytics: true, marketing: false }
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        // For logged-out users, we still log consent but userId is null
        // Since our schema requires a User, we'll only log it in DB if logged in.
        // For guests, tracking happens strictly client-side via the 'teachures_consent' cookie.

        if (req.user) {
            // Log each preference selected
            const logs = [];
            for (const [type, accepted] of Object.entries(preferences)) {
                logs.push({
                    userId: req.user.id,
                    type,
                    accepted,
                    ipAddress,
                    userAgent
                });
            }

            if (logs.length > 0) {
                await prisma.consentLog.createMany({ data: logs });
            }
        }

        // Return the preferences to the client so the frontend banner can set the cookie
        res.status(200).json({ success: true, preferences });
    } catch (error) {
        console.error('Consent save error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getMyConsent = async (req, res) => {
    try {
        // Get the most recent log for each type
        const logs = await prisma.consentLog.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        const preferences = { essential: true, analytics: false, marketing: false };
        const found = new Set();

        for (const log of logs) {
            if (!found.has(log.type)) {
                preferences[log.type] = log.accepted;
                found.add(log.type);
            }
            if (found.size >= 3) break;
        }

        res.status(200).json({ success: true, preferences });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.exportMyData = async (req, res) => {
    try {
        // Gather all relation data for GDPR export
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                enrollments: { include: { course: { select: { title: true } }, payment: true } },
                certificates: true,
                courseProgress: true,
                badges: { include: { badge: { select: { name: true } } } },
                quizAttempts: { select: { score: true, passed: true, completedAt: true, quiz: { select: { title: true } } } },
                consent: { select: { type: true, accepted: true, createdAt: true } },
                supportTickets: true
            }
        });

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Strip password hash and internal IDs where possible
        user.passwordHash = undefined;

        // Force browser to download as JSON file
        res.setHeader('Content-disposition', `attachment; filename=teachures_data_export_${user.id}.json`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(user, null, 2));

    } catch (error) {
        console.error('Data export error:', error);
        res.status(500).json({ success: false, message: 'Server error during data export' });
    }
};

exports.deleteMyAccount = async (req, res) => {
    try {
        // SOFT DELETE approach to preserve referential integrity for metrics & payments
        const deletedEmail = `deleted_${req.user.id}@teachures.local`;

        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                email: deletedEmail,
                name: 'Deleted User',
                avatar: null,
                passwordHash: null,
                oauthId: null,
                twoFactorSecret: null,
                // The user's role remains, but without password/oauth/email they cannot log in
            }
        });

        // Clear cookies to log them out immediately
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.status(200).json({ success: true, message: 'Account successfully deleted' });
    } catch (error) {
        console.error('Account deletion error:', error);
        res.status(500).json({ success: false, message: 'Server error during account deletion' });
    }
};
