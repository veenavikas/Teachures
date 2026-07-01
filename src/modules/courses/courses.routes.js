const express = require('express');
const router = express.Router();
const coursesController = require('./courses.controller');
const { requireAuth, requireRole, isCourseOwner } = require('../../middleware/auth.middleware');
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
router.put('/:id', requireRole('INSTRUCTOR', 'ADMINISTRATOR'), isCourseOwner, coursesController.updateCourse);
router.delete('/:id', requireRole('INSTRUCTOR', 'ADMINISTRATOR'), isCourseOwner, coursesController.deleteCourse);
router.post('/:id/publish', requireRole('INSTRUCTOR'), isCourseOwner, coursesController.publishCourse);
router.post('/:id/prerequisites', requireRole('INSTRUCTOR', 'ADMINISTRATOR'), isCourseOwner, coursesController.updatePrerequisites);
router.post('/:id/bulk-curriculum', requireRole('INSTRUCTOR', 'ADMINISTRATOR'), isCourseOwner, coursesController.bulkCreateCurriculum);

const announcementsController = require('./announcements.controller');
router.post('/:id/announcements', requireRole('INSTRUCTOR', 'ADMINISTRATOR'), isCourseOwner, announcementsController.createAnnouncement);
router.get('/:id/announcements', announcementsController.getAnnouncements);

// Student endpoints
router.post('/:id/rate', requireRole('STUDENT'), coursesController.rateCourse);

// Section management
router.get('/:id/sections', requireRole('INSTRUCTOR', 'ADMINISTRATOR', 'STUDENT'), coursesController.getSections);
router.post('/:id/sections', requireRole('INSTRUCTOR'), isCourseOwner, coursesController.createSection);
router.put('/sections/:sectionId', requireRole('INSTRUCTOR'), isCourseOwner, coursesController.updateSection);
router.delete('/sections/:sectionId', requireRole('INSTRUCTOR'), isCourseOwner, coursesController.deleteSection);

const assignmentsController = require('./assignments.controller');

// Lesson management
router.post('/sections/:sectionId/lessons', requireAuth, requireRole('INSTRUCTOR'), isCourseOwner, upload.single('video'), coursesController.createLesson);
router.put('/lessons/:lessonId', requireRole('INSTRUCTOR'), isCourseOwner, upload.single('video'), coursesController.updateLesson);
router.delete('/lessons/:lessonId', requireRole('INSTRUCTOR'), isCourseOwner, coursesController.deleteLesson);

// Assignment management (Instructor)
router.post('/assignments', requireRole('INSTRUCTOR'), isCourseOwner, assignmentsController.createAssignment);
router.get('/assignments/:assignmentId/submissions', requireRole('INSTRUCTOR'), isCourseOwner, assignmentsController.getAssignmentSubmissions);
router.put('/assignments/submissions/:submissionId/grade', requireRole('INSTRUCTOR'), isCourseOwner, assignmentsController.gradeSubmission);

// Assignment submission (Student)
router.post('/assignments/submit', requireRole('STUDENT'), assignmentsController.submitAssignment);

const quizzesController = require('./quizzes.controller');

// Quiz management
router.post('/quizzes', requireRole('INSTRUCTOR'), isCourseOwner, quizzesController.createQuiz);
router.post('/quizzes/submit', requireRole('STUDENT'), quizzesController.submitQuiz);

// Question Bank management
router.post('/:courseId/questions', requireRole('INSTRUCTOR'), quizzesController.addBankQuestion);
router.get('/:courseId/questions', requireRole('INSTRUCTOR'), quizzesController.getBankQuestions);
router.delete('/:courseId/questions/:questionId', requireRole('INSTRUCTOR'), quizzesController.deleteBankQuestion);

// Cohorts management
const cohortsController = require('./cohorts.controller');
router.post('/:courseId/cohorts', requireRole('INSTRUCTOR'), cohortsController.createCohort);
router.get('/:courseId/cohorts', requireRole('INSTRUCTOR'), cohortsController.getCohorts);
router.delete('/:courseId/cohorts/:cohortId', requireRole('INSTRUCTOR'), cohortsController.deleteCohort);

const ratingsController = require('./ratings.controller');

// Ratings and Reviews
router.post('/ratings', requireRole('STUDENT'), ratingsController.submitRating);
router.get('/:courseId/ratings', ratingsController.getCourseRatings);

const notesController = require('./notes.controller');
// Student Notes
router.post('/lessons/:lessonId/notes', requireRole('STUDENT'), notesController.createNote);
router.get('/lessons/:lessonId/notes', requireRole('STUDENT'), notesController.getNotes);
router.delete('/notes/:noteId', requireRole('STUDENT'), notesController.deleteNote);

const qnaController = require('./qna.controller');

// Q&A Forums
router.post('/qna', requireAuth, qnaController.postQuestion);
router.post('/qna/reply', requireAuth, qnaController.postReply);
router.get('/:courseId/qna', qnaController.getQuestions);

const couponsController = require('./coupons.controller');

// Coupons
router.post('/coupons', requireRole('INSTRUCTOR'), isCourseOwner, couponsController.createCoupon);
router.post('/coupons/validate', couponsController.validateCoupon);
router.delete('/coupons/:id', requireRole('INSTRUCTOR'), couponsController.deleteCoupon);

const certificatesController = require('./certificates.controller');

// Certificates
router.post('/:courseId/certificates/generate', requireRole('STUDENT'), certificatesController.generateCertificate);
router.get('/certificates/verify/:verifyCode', certificatesController.verifyCertificate); // Open to public verification

module.exports = router;
