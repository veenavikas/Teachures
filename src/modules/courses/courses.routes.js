const express = require('express');
const router = express.Router();
const coursesController = require('./courses.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/multer.middleware');

// Public - Browse all published courses
router.get('/', coursesController.getAllPublished);

// Public - Get course presentation/landing by slug
router.get('/:slug', coursesController.getBySlug);

// Protected routes (Instructor & Administrator)
router.use(requireAuth);

// Get current instructor's courses
router.get('/my/courses', requireRole('INSTRUCTOR'), coursesController.getMyCourses);

// Instructor endpoints
router.post('/', requireRole('INSTRUCTOR'), coursesController.createCourse);
router.put('/:id', requireRole('INSTRUCTOR', 'ADMINISTRATOR'), coursesController.updateCourse);
router.delete('/:id', requireRole('INSTRUCTOR', 'ADMINISTRATOR'), coursesController.deleteCourse);
router.post('/:id/publish', requireRole('INSTRUCTOR'), coursesController.publishCourse);

// Student endpoints
router.post('/:id/rate', requireRole('STUDENT'), coursesController.rateCourse);

// Section management
router.get('/:id/sections', requireRole('INSTRUCTOR', 'ADMINISTRATOR', 'STUDENT'), coursesController.getSections);
router.post('/:id/sections', requireRole('INSTRUCTOR'), coursesController.createSection);
router.put('/sections/:sectionId', requireRole('INSTRUCTOR'), coursesController.updateSection);
router.delete('/sections/:sectionId', requireRole('INSTRUCTOR'), coursesController.deleteSection);

const assignmentsController = require('./assignments.controller');

// Lesson management
router.post('/sections/:sectionId/lessons', requireAuth, requireRole('INSTRUCTOR'), upload.single('video'), coursesController.createLesson);
router.put('/lessons/:lessonId', requireRole('INSTRUCTOR'), upload.single('video'), coursesController.updateLesson);
router.delete('/lessons/:lessonId', requireRole('INSTRUCTOR'), coursesController.deleteLesson);

// Assignment management (Instructor)
router.post('/assignments', requireRole('INSTRUCTOR'), assignmentsController.createAssignment);
router.get('/assignments/:assignmentId/submissions', requireRole('INSTRUCTOR'), assignmentsController.getAssignmentSubmissions);
router.put('/assignments/submissions/:submissionId/grade', requireRole('INSTRUCTOR'), assignmentsController.gradeSubmission);

// Assignment submission (Student)
router.post('/assignments/submit', requireRole('STUDENT'), assignmentsController.submitAssignment);

const quizzesController = require('./quizzes.controller');

// Quiz management
router.post('/quizzes', requireRole('INSTRUCTOR'), quizzesController.createQuiz);
router.post('/quizzes/submit', requireRole('STUDENT'), quizzesController.submitQuiz);

const ratingsController = require('./ratings.controller');

// Ratings and Reviews
router.post('/ratings', requireRole('STUDENT'), ratingsController.submitRating);
router.get('/:courseId/ratings', ratingsController.getCourseRatings);

const qnaController = require('./qna.controller');

// Q&A Forums
router.post('/qna', requireAuth, qnaController.postQuestion);
router.post('/qna/reply', requireAuth, qnaController.postReply);
router.get('/:courseId/qna', qnaController.getQuestions);

const couponsController = require('./coupons.controller');

// Coupons
router.post('/coupons', requireRole('INSTRUCTOR'), couponsController.createCoupon);
router.post('/coupons/validate', couponsController.validateCoupon);

const certificatesController = require('./certificates.controller');

// Certificates
router.post('/:courseId/certificates/generate', requireRole('STUDENT'), certificatesController.generateCertificate);
router.get('/certificates/verify/:verifyCode', certificatesController.verifyCertificate); // Open to public verification

module.exports = router;
