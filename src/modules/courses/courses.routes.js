const express = require('express');
const router = express.Router();
const coursesController = require('./courses.controller');
const { requireAuth, requireRole } = require('../../middleware/auth.middleware');
const upload = require('../../middleware/multer.middleware');

// Public - Browse all published courses
router.get('/', coursesController.getAllPublished);

// Public - Get course presentation/landing by slug
router.get('/:slug', coursesController.getBySlug);

// Protected routes (Trainer & Admin)
router.use(requireAuth);

// Get current trainer's courses
router.get('/my/courses', requireRole('TRAINER'), coursesController.getMyCourses);

// Trainer endpoints
router.post('/', requireRole('TRAINER'), coursesController.createCourse);
router.put('/:id', requireRole('TRAINER', 'ADMIN'), coursesController.updateCourse);
router.delete('/:id', requireRole('TRAINER', 'ADMIN'), coursesController.deleteCourse);
router.post('/:id/publish', requireRole('TRAINER'), coursesController.publishCourse);

// Learner endpoints
router.post('/:id/rate', requireRole('LEARNER'), coursesController.rateCourse);

// Section management
router.get('/:id/sections', requireRole('TRAINER', 'ADMIN', 'LEARNER'), coursesController.getSections);
router.post('/:id/sections', requireRole('TRAINER'), coursesController.createSection);
router.put('/sections/:sectionId', requireRole('TRAINER'), coursesController.updateSection);
router.delete('/sections/:sectionId', requireRole('TRAINER'), coursesController.deleteSection);

// Lesson management
router.post('/sections/:sectionId/lessons', requireAuth, requireRole('TRAINER'), upload.single('video'), coursesController.createLesson);
router.put('/lessons/:lessonId', requireRole('TRAINER'), coursesController.updateLesson);
router.delete('/lessons/:lessonId', requireRole('TRAINER'), coursesController.deleteLesson);

module.exports = router;
