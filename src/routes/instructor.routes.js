const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');


router.use(requireAuth, requireRole('INSTRUCTOR'));

// Instructor Onboarding
router.get('/onboarding', async (req, res) => {
    try {
        const profile = await prisma.instructorProfile.findUnique({
            where: { userId: req.user.id }
        });
        
        // If already onboarded, redirect to dashboard
        if (profile && profile.paypalAccountId && profile.bio) {
            return res.redirect('/instructor/dashboard');
        }

        res.render('instructor/onboarding', {
            layout: 'layouts/dashboard',
            title: 'Trainer Onboarding',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor'
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.post('/onboarding', async (req, res) => {
    try {
        const { bio, expertise, website, paypalAccountId } = req.body;
        
        // Validate required fields
        if (!paypalAccountId) {
            return res.status(400).json({ success: false, message: 'PayPal Account ID is required for payouts.' });
        }

        const profile = await prisma.instructorProfile.upsert({
            where: { userId: req.user.id },
            update: { bio, expertise, website, paypalAccountId },
            create: { userId: req.user.id, bio, expertise, website, paypalAccountId }
        });

        res.json({ success: true, data: profile });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error during onboarding.' });
    }
});

// Instructor Profile
router.get('/profile', async (req, res) => {
    try {
        const profile = await prisma.instructorProfile.findUnique({
            where: { userId: req.user.id }
        });

        res.render('instructor/profile', {
            layout: 'layouts/dashboard',
            title: 'My Profile',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            profile: profile || {}
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.post('/profile', async (req, res) => {
    try {
        const { bio, expertise, website, paypalAccountId } = req.body;

        const profile = await prisma.instructorProfile.upsert({
            where: { userId: req.user.id },
            update: { bio, expertise, website, paypalAccountId },
            create: { userId: req.user.id, bio, expertise, website, paypalAccountId }
        });

        res.json({ success: true, data: profile, message: 'Profile updated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error updating profile.' });
    }
});

// Instructor Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const courseCount = await prisma.course.count({ where: { instructorId: req.user.id } });

        // Real analytics for instructor
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            include: {
                _count: { select: { enrollments: true } },
                ratings: { select: { rating: true } },
                enrollments: {
                    include: { payment: true, user: true },
                    orderBy: { enrolledAt: 'desc' },
                    take: 5
                }
            }
        });

        let totalStudents = 0, monthlyEarnings = 0, totalRatingSum = 0, ratingCount = 0;
        let recentEnrollments = [];

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const now = new Date();
        const chartData = [0, 0, 0, 0];

        courses.forEach(c => {
            totalStudents += c._count.enrollments;
            c.ratings.forEach(r => { totalRatingSum += r.rating; ratingCount++; });
            c.enrollments.forEach(e => {
                recentEnrollments.push({ text: `New enrollment: ${e.user.name} in "${c.title}"`, time: e.enrolledAt.toLocaleDateString() });
                if (e.payment && e.payment.status === 'COMPLETED' && e.payment.createdAt >= thirtyDaysAgo) {
                    monthlyEarnings += e.payment.amount;
                }
                
                const diffTime = Math.abs(now - e.enrolledAt);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) chartData[3]++;
                else if (diffDays <= 14) chartData[2]++;
                else if (diffDays <= 21) chartData[1]++;
                else if (diffDays <= 28) chartData[0]++;
            });
        });

        // Sort and limit recent activity
        recentEnrollments.sort((a, b) => new Date(b.time) - new Date(a.time));
        const recentActivity = recentEnrollments.slice(0, 5);

        const stats = {
            totalStudents,
            monthlyEarnings,
            activeCourses: courseCount,
            avgRating: ratingCount > 0 ? (totalRatingSum / ratingCount).toFixed(1) : 0,
            totalReviews: ratingCount,
            chartData: JSON.stringify(chartData)
        };

        const instructorLeaderboard = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                enrollments: {
                    some: { course: { instructorId: req.user.id } }
                }
            },
            orderBy: { totalPoints: 'desc' },
            take: 10,
            select: { id: true, name: true, email: true, totalPoints: true }
        });

        res.render('instructor/dashboard', {
            layout: 'layouts/dashboard',
            title: 'Instructor Dashboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            stats,
            recentActivity,
            instructorLeaderboard
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// My Courses List
router.get('/courses', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });

        res.render('instructor/courses/index', {
            layout: 'layouts/dashboard',
            title: 'My Courses',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            courses
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Create Course Wizard
router.get('/courses/create', (req, res) => {
    res.render('instructor/courses/create', {
        layout: 'layouts/dashboard',
        title: 'Create Course',
        path: req.originalUrl,
        user: req.user,
        sidebarPartial: '../partials/sidebar-instructor'
    });
});

// Assignments Grading Dashboard
router.get('/assignments', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            select: { id: true }
        });
        const courseIds = courses.map(c => c.id);

        const submissions = await prisma.assignmentSubmission.findMany({
            where: {
                assignment: {
                    lesson: {
                        section: {
                            courseId: { in: courseIds }
                        }
                    }
                }
            },
            include: {
                user: { select: { name: true, email: true } },
                assignment: {
                    include: {
                        lesson: { select: { title: true } }
                    }
                }
            },
            orderBy: { submittedAt: 'desc' }
        });

        res.render('instructor/assignments/index', {
            layout: 'layouts/dashboard',
            title: 'Assignments & Grading',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            submissions
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Course Editor
router.get('/courses/:id/edit', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: { prerequisites: true }
        });

        if (!course || course.instructorId !== req.user.id) {
            return res.status(404).send('Course not found');
        }

        // Fetch other courses by this instructor to act as potential prerequisites
        const otherCourses = await prisma.course.findMany({
            where: { 
                instructorId: req.user.id,
                id: { not: course.id }
            },
            select: { id: true, title: true }
        });

        res.render('instructor/courses/edit', {
            layout: 'layouts/dashboard',
            title: `Edit: ${course.title}`,
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            course,
            otherCourses
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// Learning Paths Management
router.get('/learning-paths', async (req, res) => {
    try {
        // Find paths that contain any of this instructor's courses
        // Or if we want paths to be instructor specific we need a relation. Right now paths are global but maybe only show paths?
        // Wait, LearningPath doesn't have an instructorId. Let's just fetch all paths for now, or paths where instructor has a course.
        // For simplicity, let's allow instructor to see all paths or just the paths they manage.
        const paths = await prisma.learningPath.findMany({
            include: {
                courses: { include: { course: true } }
            }
        });
        
        // Also fetch instructor's courses to create new paths
        const myCourses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            select: { id: true, title: true }
        });

        res.render('instructor/paths/index', {
            layout: 'layouts/dashboard',
            title: 'Learning Paths',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            paths,
            myCourses
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Instructor Analytics
router.get('/analytics', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            include: {
                _count: { select: { enrollments: true } },
                ratings: { select: { rating: true } },
                sections: {
                    include: {
                        lessons: {
                            include: {
                                progress: true,
                                quiz: { include: { attempts: true } }
                            }
                        }
                    }
                }
            }
        });

        let totalStudents = 0, totalRevenue = 0, totalRatingSum = 0, ratingCount = 0;
        let totalWatchedSeconds = 0, totalQuizAttempts = 0, totalQuizScore = 0;

        courses.forEach(c => {
            totalStudents += c._count.enrollments;
            totalRevenue += c._count.enrollments * (c.price || 0);
            c.ratings.forEach(r => { totalRatingSum += r.rating; ratingCount++; });
            
            c.sections.forEach(s => {
                s.lessons.forEach(l => {
                    l.progress.forEach(p => { totalWatchedSeconds += p.watchedSeconds; });
                    if (l.quiz) {
                        l.quiz.attempts.forEach(a => {
                            totalQuizAttempts++;
                            totalQuizScore += a.score;
                        });
                    }
                });
            });
        });

        const analytics = {
            totalCourses: courses.length,
            totalStudents,
            totalRevenue,
            avgRating: ratingCount > 0 ? totalRatingSum / ratingCount : 0,
            ratingCount,
            courses,
            avgQuizScore: totalQuizAttempts > 0 ? (totalQuizScore / totalQuizAttempts).toFixed(1) : 0,
            avgWatchedMins: (totalWatchedSeconds / 60).toFixed(1)
        };

        res.render('instructor/analytics', {
            layout: 'layouts/dashboard',
            title: 'Analytics',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            analytics
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});



router.get('/coupons', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            select: { id: true, title: true }
        });

        const coupons = await prisma.coupon.findMany({
            where: {
                OR: [
                    { courseId: null },
                    { courseId: { in: courses.map(c => c.id) } }
                ]
            },
            include: { course: true },
            orderBy: { createdAt: 'desc' }
        });

        res.render('instructor/coupons', {
            layout: 'layouts/dashboard',
            title: 'Manage Coupons',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            courses,
            coupons
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.get('/assignments', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            select: { id: true }
        });

        const courseIds = courses.map(c => c.id);

        const submissions = await prisma.assignmentSubmission.findMany({
            where: {
                assignment: {
                    lesson: {
                        section: { courseId: { in: courseIds } }
                    }
                }
            },
            include: {
                assignment: {
                    include: { lesson: { select: { title: true } } }
                },
                user: { select: { name: true, email: true } }
            },
            orderBy: { submittedAt: 'desc' }
        });

        res.render('instructor/assignments', {
            layout: 'layouts/dashboard',
            title: 'Assignments & Grading',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            submissions
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});



router.get('/announcements', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            select: { id: true, title: true }
        });

        const announcements = await prisma.announcement.findMany({
            where: { course: { instructorId: req.user.id } },
            include: { course: { select: { title: true } } },
            orderBy: { createdAt: 'desc' }
        });

        res.render('instructor/announcements', {
            layout: 'layouts/dashboard',
            title: 'Announcements',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            courses,
            announcements
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.get('/support', async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        res.render('instructor/support', {
            layout: 'layouts/dashboard',
            title: 'Support Center',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            tickets
        });
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.get('/qna', async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            select: { id: true, title: true }
        });

        const courseIds = courses.map(c => c.id);

        const qnas = await prisma.courseQnA.findMany({
            where: { courseId: { in: courseIds } },
            include: {
                user: { select: { name: true, avatar: true } },
                course: { select: { title: true } },
                replies: {
                    include: { user: { select: { name: true, role: true } } },
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.render('instructor/qna', {
            layout: 'layouts/dashboard',
            title: 'Q&A Forums',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-instructor',
            qnas
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.get('/privacy', async (req, res) => {
    const logs = await prisma.consentLog.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' }
    });
    const consent = { essential: true, analytics: false, marketing: false };
    const found = new Set();
    for (const log of logs) {
        if (!found.has(log.type)) {
            consent[log.type] = log.accepted;
            found.add(log.type);
        }
        if (found.size >= 3) break;
    }

    // Share the same view as student since features are identical
    res.render('student/privacy', {
        title: 'Privacy & Data',
        path: '/instructor/privacy',
        consent
    });
});

router.post('/privacy/consent', async (req, res) => {
    try {
        const { preferences } = req.body;
        if (!preferences) return res.status(400).json({ success: false, message: 'Preferences required' });
        
        for (const [key, val] of Object.entries(preferences)) {
            await prisma.consentLog.create({
                data: {
                    userId: req.user.id,
                    type: key,
                    accepted: val === true || val === 'true',
                    ipAddress: req.ip || '0.0.0.0',
                    userAgent: req.headers['user-agent'] || 'Unknown'
                }
            });
        }
        res.json({ success: true, message: 'Consent updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ─── EARNINGS & PAYOUTS ────────────────────────────────────
router.get('/earnings', async (req, res) => {
    try {
        const profile = await prisma.instructorProfile.findUnique({
            where: { userId: req.user.id }
        });

        // Calculate earnings from COMPLETED payments
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            select: { id: true, title: true }
        });
        
        const courseIds = courses.map(c => c.id);

        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: { in: courseIds } },
            include: { payment: true, course: true, user: true },
            orderBy: { enrolledAt: 'desc' }
        });

        let lifetimeEarnings = 0;
        let recentTransactions = [];

        enrollments.forEach(e => {
            if (e.payment && e.payment.status === 'COMPLETED') {
                const amount = e.payment.amount;
                // e.g. 70% commission
                const commission = amount * 0.7;
                lifetimeEarnings += commission;

                recentTransactions.push({
                    course: e.course.title,
                    student: e.user.name,
                    date: e.payment.createdAt,
                    amount: commission
                });
            }
        });

        const payoutRequests = await prisma.payoutRequest.findMany({
            where: { instructorId: req.user.id },
            orderBy: { requestedAt: 'desc' }
        });

        let paidOut = payoutRequests
            .filter(pr => pr.status === 'COMPLETED')
            .reduce((sum, pr) => sum + pr.amount, 0);

        let pendingPayout = payoutRequests
            .filter(pr => pr.status === 'PENDING')
            .reduce((sum, pr) => sum + pr.amount, 0);

        let availableBalance = lifetimeEarnings - paidOut - pendingPayout;
        if (availableBalance < 0) availableBalance = 0;

        res.render('instructor/earnings', {
            title: 'Earnings & Payouts',
            path: '/instructor/earnings',
            profile,
            lifetimeEarnings,
            availableBalance,
            pendingPayout,
            recentTransactions: recentTransactions.slice(0, 20),
            payoutRequests
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

router.post('/payouts/request', async (req, res) => {
    try {
        const { amount } = req.body;
        const requestAmount = parseFloat(amount);
        
        if (isNaN(requestAmount) || requestAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }

        const profile = await prisma.instructorProfile.findUnique({
            where: { userId: req.user.id }
        });

        if (!profile || !profile.paypalAccountId) {
            return res.status(400).json({ success: false, message: 'Please configure your PayPal account in onboarding.' });
        }

        // Extremely naive balance check (for real app, compute precisely in transaction)
        const newRequest = await prisma.payoutRequest.create({
            data: {
                instructorId: req.user.id,
                amount: requestAmount,
                payoutEmail: profile.paypalAccountId,
                paypalAccountId: profile.paypalAccountId,
                status: 'PENDING'
            }
        });

        res.json({ success: true, data: newRequest });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
