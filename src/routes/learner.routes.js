const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { generateSignedUrl } = require('../services/s3.service');

router.use(requireAuth, requireRole('LEARNER'));

// Learner Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const myCourses = await prisma.course.findMany({
            take: 4,
            orderBy: { createdAt: 'desc' }
        }).then(courses => courses.map(c => ({
            title: c.title,
            slug: c.slug,
            thumbnailUrl: c.thumbnailUrl || '/images/default-course.jpg',
            trainerName: 'Jane Doe',
            progress: Math.floor(Math.random() * 100)
        })));

        const badges = [];
        const leaders = [
            { name: 'Alice', points: 450 },
            { name: 'Bob', points: 320 },
            { name: 'Charlie', points: 190 }
        ];

        res.render('learner/dashboard', {
            layout: 'layouts/dashboard',
            title: 'Learner Dashboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-learner',
            myCourses,
            badges,
            leaders
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Gamification — XP, Badges, Leaderboard
router.get('/gamification', async (req, res) => {
    try {
        const userBadges = await prisma.userBadge.findMany({
            where: { userId: req.user.id },
            include: { badge: true }
        });

        const leaderboard = await prisma.user.findMany({
            where: { role: 'LEARNER' },
            orderBy: { points: 'desc' },
            take: 10,
            select: { id: true, name: true, points: true }
        });

        res.render('learner/gamification', {
            layout: 'layouts/dashboard',
            title: 'Achievements & Leaderboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-learner',
            badges: userBadges,
            leaders: leaderboard.map(u => ({ ...u, isYou: u.id === req.user.id }))
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// My Certificates
router.get('/certificates', async (req, res) => {
    try {
        const certificates = await prisma.certificate.findMany({
            where: { userId: req.user.id },
            include: { course: { select: { title: true, slug: true } } },
            orderBy: { issuedAt: 'desc' }
        });

        res.render('learner/certificates', {
            layout: 'layouts/dashboard',
            title: 'My Certificates',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-learner',
            certificates
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Support Tickets
router.get('/support', async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        res.render('learner/support', {
            layout: 'layouts/dashboard',
            title: 'Support Center',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-learner',
            tickets
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Submit Support Ticket
router.post('/support', async (req, res) => {
    try {
        const { subject, description, priority } = req.body;
        await prisma.supportTicket.create({
            data: { userId: req.user.id, subject, description, priority: priority || 'MEDIUM' }
        });
        res.redirect('/learner/support');
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Quiz Player - GET a specific quiz
router.get('/quiz/:quizId', async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.quizId },
            include: { questions: { include: { options: true } } }
        });

        if (!quiz) return res.status(404).send('Quiz not found');

        res.render('learner/quiz-player', {
            layout: false,
            quiz,
            user: req.user
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// My Courses List
router.get('/my-courses', async (req, res) => {
    try {
        const enrollments = await prisma.enrollment.findMany({
            where: { userId: req.user.id },
            include: {
                course: {
                    include: {
                        trainer: { select: { name: true } },
                        _count: { select: { sections: true } }
                    }
                }
            },
            orderBy: { enrolledAt: 'desc' }
        });

        const progress = await prisma.courseProgress.findMany({
            where: { userId: req.user.id }
        });

        const courses = enrollments.map(e => ({
            ...e.course,
            progress: progress.find(p => p.courseId === e.course.id)?.percentComplete || 0
        }));

        res.render('learner/my-courses', {
            layout: 'layouts/dashboard',
            title: 'My Learning',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-learner',
            courses
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Course Player
router.get('/courses/:slug/learn', async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { slug: req.params.slug },
            include: {
                sections: {
                    orderBy: { order: 'asc' },
                    include: { lessons: { orderBy: { order: 'asc' } } }
                }
            }
        });

        if (!course) return res.status(404).send('Course not found');

        const selectedLessonId = req.query.lessonId;
        let activeLesson = null;
        let preSignedVideoUrl = null;

        if (course.sections.length > 0 && course.sections[0].lessons.length > 0) {
            if (selectedLessonId) {
                course.sections.forEach(s => {
                    const l = s.lessons.find(ls => ls.id === selectedLessonId);
                    if (l) activeLesson = l;
                });
            }
            if (!activeLesson) activeLesson = course.sections[0].lessons[0];
            if (activeLesson.type === 'VIDEO' && activeLesson.videoUrl) {
                preSignedVideoUrl = await generateSignedUrl(activeLesson.videoUrl, 7200);
            }
        }

        res.render('learner/course-player', {
            layout: false,
            title: course.title,
            course,
            activeLesson,
            preSignedVideoUrl,
            user: req.user
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Mark lesson complete
router.post('/courses/:courseId/progress', async (req, res) => {
    try {
        const { courseId } = req.params;

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId } }
        });
        if (!enrollment) return res.status(403).json({ success: false, message: 'Not enrolled' });

        const progress = await prisma.courseProgress.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId } }
        });

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: { sections: { include: { lessons: true } } }
        });

        let totalLessons = 0;
        course.sections.forEach(s => totalLessons += s.lessons.length);

        const newCompleted = (progress?.completedLessons || 0) + 1;
        const percent = totalLessons > 0 ? (newCompleted / totalLessons) * 100 : 100;

        await prisma.courseProgress.upsert({
            where: { userId_courseId: { userId: req.user.id, courseId } },
            update: { completedLessons: newCompleted, percentComplete: percent > 100 ? 100 : percent, lastAccessed: new Date() },
            create: { userId: req.user.id, courseId, completedLessons: 1, percentComplete: totalLessons > 0 ? (1 / totalLessons) * 100 : 100 }
        });

        res.json({ success: true, percentComplete: percent });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/privacy', async (req, res) => {
    // Fetch user's latest consent logs
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
    res.render('learner/privacy', {
        layout: 'layouts/dashboard',
        title: 'Privacy Settings',
        path: req.originalUrl,
        user: req.user,
        sidebarPartial: '../partials/sidebar-learner',
        consent
    });
});

// Support Center
router.get('/support', requireAuth, require('../../modules/support/support.controller').getMyTickets);

module.exports = router;
