const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth.middleware');
const { generateSignedUrl } = require('../services/file.service');
const { awardPoints } = require('../modules/gamification/gamification.controller');
const { checkAndAwardBadge } = require('../modules/gamification/badges.controller');

router.use(requireAuth, requireRole('STUDENT'));

// Student Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const myCourses = await prisma.course.findMany({
            take: 4,
            orderBy: { createdAt: 'desc' }
        }).then(courses => courses.map(c => ({
            title: c.title,
            slug: c.slug,
            thumbnailUrl: c.thumbnailUrl || '/images/default-course.jpg',
            instructorName: 'Jane Doe',
            progress: Math.floor(Math.random() * 100)
        })));

        const badges = await prisma.userBadge.findMany({
            where: { userId: req.user.id },
            include: { badge: true },
            orderBy: { awardedAt: 'desc' }
        });
        
        const leaders = [
            { name: 'Alice', points: 450 },
            { name: 'Bob', points: 320 },
            { name: 'Charlie', points: 190 }
        ];

        res.render('student/dashboard', {
            layout: 'layouts/dashboard',
            title: 'Student Dashboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
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
            where: { role: 'STUDENT' },
            orderBy: { points: 'desc' },
            take: 10,
            select: { id: true, name: true, points: true }
        });

        res.render('student/gamification', {
            layout: 'layouts/dashboard',
            title: 'Achievements & Leaderboard',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
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

        res.render('student/certificates', {
            layout: 'layouts/dashboard',
            title: 'My Certificates',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
            certificates
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// View Certificate (HTML)
router.get('/certificates/:id/view', async (req, res) => {
    try {
        const certificate = await prisma.certificate.findUnique({
            where: { id: req.params.id },
            include: {
                user: true,
                course: {
                    include: { instructor: true }
                }
            }
        });

        if (!certificate || certificate.userId !== req.user.id) {
            return res.status(404).send('Certificate not found or unauthorized');
        }

        res.render('student/certificate-view', {
            layout: false,
            certificate,
            user: certificate.user,
            course: certificate.course
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

        res.render('student/support', {
            layout: 'layouts/dashboard',
            title: 'Support Center',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
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
        res.redirect('/student/support');
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Quiz Player - GET a specific quiz
router.get('/quiz/:quizId', async (req, res) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: req.params.quizId },
            include: { 
                questions: { include: { options: true } },
                lesson: { include: { section: true } }
            }
        });

        if (!quiz) return res.status(404).send('Quiz not found');

        // Handle dynamic question pulling from course bank
        if (quiz.pullRandomCount && quiz.pullRandomCount > 0) {
            const courseId = quiz.lesson.section.courseId;
            const bankQuestions = await prisma.question.findMany({
                where: { courseId },
            });
            
            // Randomly select N questions
            const shuffled = bankQuestions.sort(() => 0.5 - Math.random());
            quiz.questions = shuffled.slice(0, quiz.pullRandomCount);
        }

        res.render('student/quiz-player', {
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
                        instructor: { select: { name: true } },
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

        res.render('student/my-courses', {
            layout: 'layouts/dashboard',
            title: 'My Learning',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
            courses
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Learning Paths
router.get('/learning-paths', async (req, res) => {
    try {
        const paths = await prisma.learningPath.findMany({
            include: {
                courses: {
                    orderBy: { order: 'asc' },
                    include: { course: true }
                }
            }
        });

        // Get student progress
        const progress = await prisma.courseProgress.findMany({
            where: { userId: req.user.id }
        });

        // Enrich paths with progress logic
        const enrichedPaths = paths.map(path => {
            const enrichedCourses = path.courses.map(pc => {
                const prog = progress.find(p => p.courseId === pc.course.id);
                return {
                    ...pc.course,
                    percentComplete: prog ? prog.percentComplete : 0
                };
            });
            return {
                ...path,
                courses: enrichedCourses
            };
        });

        res.render('student/learning-paths', {
            layout: 'layouts/dashboard',
            title: 'Learning Paths',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
            paths: enrichedPaths
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
                },
                announcements: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!course) return res.status(404).send('Course not found');

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
            include: { cohort: true }
        });
        if (!enrollment) return res.status(403).send('Not enrolled');

        // Cohort-based drip logic: calculate from cohort start date if exists, else enrolled date
        const baseDateForDrip = enrollment.cohort ? new Date(enrollment.cohort.startDate) : new Date(enrollment.enrolledAt);
        const currentDate = new Date();

        // Fetch completed lessons for the user
        const lessonProgresses = await prisma.lessonProgress.findMany({
            where: { userId: req.user.id, lesson: { section: { courseId: course.id } } }
        });
        const completedLessonIds = new Set(lessonProgresses.filter(lp => lp.isCompleted).map(lp => lp.lessonId));

        // Flatten lessons to calculate sequential locks
        const flatLessons = [];
        course.sections.forEach(s => {
            s.lessons.forEach(l => {
                flatLessons.push(l);
            });
        });

        // Attach isLocked property to each lesson
        flatLessons.forEach((l, index) => {
            l.isLocked = false;
            l.lockReason = null;
            
            // Check sequential locking
            if (index > 0) {
                const previousLesson = flatLessons[index - 1];
                if (!completedLessonIds.has(previousLesson.id)) {
                    l.isLocked = true;
                    l.lockReason = 'complete_previous';
                }
            }

            // Check drip locking
            if (!l.isLocked && l.dripDays > 0) {
                const unlockDate = new Date(baseDateForDrip);
                unlockDate.setDate(unlockDate.getDate() + l.dripDays);
                if (currentDate < unlockDate) {
                    l.isLocked = true;
                    l.lockReason = 'drip_locked';
                    l.unlockDate = unlockDate;
                }
            }

            l.isCompleted = completedLessonIds.has(l.id);
        });

        const selectedLessonId = req.query.lessonId;
        let activeLesson = null;
        let preSignedVideoUrl = null;

        if (flatLessons.length > 0) {
            if (selectedLessonId) {
                activeLesson = flatLessons.find(ls => ls.id === selectedLessonId);
            }
            if (!activeLesson) activeLesson = flatLessons[0];
            
            // Backend enforcement: if locked, don't serve content
            if (activeLesson.isLocked) {
                activeLesson = { ...activeLesson, isLocked: true, videoUrl: null, content: "Complete previous lessons to unlock this content." };
            } else if (activeLesson.type === 'VIDEO' && activeLesson.videoUrl) {
                preSignedVideoUrl = await generateSignedUrl(activeLesson.videoUrl, 7200);
            } else if (activeLesson.type === 'ASSIGNMENT') {
                const assignment = await prisma.assignment.findUnique({
                    where: { lessonId: activeLesson.id },
                    include: { submissions: { where: { userId: req.user.id } } }
                });
                activeLesson.assignment = assignment;
            }
        }

        let notes = [];
        if (activeLesson) {
            notes = await prisma.note.findMany({
                where: { lessonId: activeLesson.id, userId: req.user.id },
                orderBy: { timestamp: 'asc' }
            });
        }

        res.render('student/course-player', {
            layout: false,
            title: course.title,
            course,
            activeLesson,
            preSignedVideoUrl,
            user: req.user,
            announcements: course.announcements || [],
            notes
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// Mark lesson complete
router.post('/courses/:courseId/progress', async (req, res) => {
    try {
        const { courseId } = req.params;
        const { lessonId, watchedSeconds } = req.body;

        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId } }
        });
        if (!enrollment) return res.status(403).json({ success: false, message: 'Not enrolled' });

        if (lessonId) {
            let updateData = {};
            let createData = { userId: req.user.id, lessonId };

            if (req.body.isCompleted || req.body.isCompleted === undefined) {
                // If explicitly completing or default mark complete
                updateData.isCompleted = true;
                updateData.completedAt = new Date();
                createData.isCompleted = true;
                createData.completedAt = new Date();
            }

            if (watchedSeconds !== undefined) {
                updateData.watchedSeconds = parseInt(watchedSeconds);
                createData.watchedSeconds = parseInt(watchedSeconds);
            }

            await prisma.lessonProgress.upsert({
                where: { userId_lessonId: { userId: req.user.id, lessonId } },
                update: updateData,
                create: createData
            });
        }

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: { sections: { include: { lessons: true } } }
        });

        const lessonProgresses = await prisma.lessonProgress.findMany({
            where: { userId: req.user.id, lesson: { section: { courseId } }, isCompleted: true }
        });

        let totalLessons = 0;
        course.sections.forEach(s => totalLessons += s.lessons.length);

        const newCompleted = lessonProgresses.length;
        const percent = totalLessons > 0 ? (newCompleted / totalLessons) * 100 : 100;

        await prisma.courseProgress.upsert({
            where: { userId_courseId: { userId: req.user.id, courseId } },
            update: { completedLessons: newCompleted, percentComplete: percent > 100 ? 100 : percent, lastAccessedAt: new Date() },
            create: { userId: req.user.id, courseId, completedLessons: newCompleted, percentComplete: percent > 100 ? 100 : percent }
        });

        // Generate Certificate if 100%
        if (percent >= 100) {
            const certExists = await prisma.certificate.findUnique({
                where: { userId_courseId: { userId: req.user.id, courseId } }
            });
            if (!certExists) {
                await prisma.certificate.create({
                    data: {
                        userId: req.user.id,
                        courseId: courseId,
                        pdfUrl: '/student/certificates/' + courseId
                    }
                });
                
                // Gamification: Award First Course Completed Badge
                const completedCourses = await prisma.courseProgress.count({
                    where: { userId: req.user.id, percentComplete: 100 }
                });
                if (completedCourses === 1) {
                    await checkAndAwardBadge(req.user.id, 'complete_1_course');
                }
            }
        }

        if (lessonId) {
            // Award 10 points for completing a lesson
            await awardPoints(req.user.id, 10);
        }

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
    res.render('student/privacy', {
        layout: 'layouts/dashboard',
        title: 'Privacy Settings',
        path: req.originalUrl,
        user: req.user,
        sidebarPartial: '../partials/sidebar-student',
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

// Support Center
router.get('/support', requireAuth, require('../modules/support/support.controller').getMyTickets);

// User Profile
router.get('/profile', (req, res) => {
    res.render('student/profile', {
        layout: 'layouts/dashboard',
        title: 'My Profile',
        path: req.originalUrl,
        user: req.user,
        sidebarPartial: '../partials/sidebar-student'
    });
});

// ─── COMMUNITY FORUMS ──────────────────────────────────────────────

router.get('/community', async (req, res) => {
    try {
        const categories = await prisma.communityCategory.findMany({
            where: { tenantId: req.tenant.id },
            include: { _count: { select: { topics: true } } },
            orderBy: { order: 'asc' }
        });

        res.render('student/community/index', {
            layout: 'layouts/dashboard',
            title: 'Community Forums',
            path: '/student/community',
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
            categories
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.get('/community/:categoryId', async (req, res) => {
    try {
        const category = await prisma.communityCategory.findUnique({
            where: { id: req.params.categoryId }
        });

        if (!category) return res.status(404).send('Category not found');

        const topics = await prisma.communityTopic.findMany({
            where: { categoryId: category.id },
            include: { author: true, _count: { select: { replies: true } } },
            orderBy: { updatedAt: 'desc' }
        });

        res.render('student/community/category', {
            layout: 'layouts/dashboard',
            title: category.name,
            path: '/student/community',
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
            category,
            topics
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.get('/community/topics/:topicId', async (req, res) => {
    try {
        const topic = await prisma.communityTopic.findUnique({
            where: { id: req.params.topicId },
            include: { 
                author: true, 
                category: true,
                replies: {
                    include: { author: true },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!topic) return res.status(404).send('Topic not found');

        res.render('student/community/topic', {
            layout: 'layouts/dashboard',
            title: topic.title,
            path: '/student/community',
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
            topic
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

// ─── PEER REVIEWS ────────────────────────────────────────────────────

router.get('/peer-reviews', async (req, res) => {
    try {
        const pendingReviews = await prisma.peerReview.findMany({
            where: { reviewerId: req.user.id, status: 'PENDING' },
            include: {
                submission: {
                    include: {
                        assignment: {
                            include: { lesson: { include: { section: { include: { course: true } } } } }
                        }
                    }
                }
            }
        });

        const completedReviews = await prisma.peerReview.findMany({
            where: { reviewerId: req.user.id, status: 'COMPLETED' },
            include: {
                submission: {
                    include: {
                        assignment: {
                            include: { lesson: { include: { section: { include: { course: true } } } } }
                        }
                    }
                }
            }
        });

        res.render('student/peer-reviews', {
            layout: 'layouts/dashboard',
            title: 'Peer Reviews',
            path: '/student/peer-reviews',
            user: req.user,
            sidebarPartial: '../partials/sidebar-student',
            pendingReviews,
            completedReviews
        });
    } catch (error) {
        res.status(500).send('Server Error: ' + error.message);
    }
});

router.post('/peer-reviews/:reviewId', async (req, res) => {
    try {
        const { feedback, grade } = req.body;
        
        const review = await prisma.peerReview.findUnique({
            where: { id: req.params.reviewId }
        });

        if (!review || review.reviewerId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        await prisma.peerReview.update({
            where: { id: req.params.reviewId },
            data: {
                feedback,
                grade: parseInt(grade),
                status: 'COMPLETED'
            }
        });

        res.json({ success: true, message: 'Review submitted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
