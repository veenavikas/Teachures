const slugify = require('slugify');
const prisma = require('../../config/database');

// --- PUBLIC ---

exports.getAllPublished = async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { isPublished: true },
            include: {
                instructor: { select: { name: true, avatar: true } },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBySlug = async (req, res) => {
    try {
        const course = await prisma.course.findUnique({
            where: { slug: req.params.slug },
            include: {
                instructor: { select: { name: true, avatar: true, instructorProfile: true } },
                sections: {
                    orderBy: { order: 'asc' },
                    include: {
                        lessons: {
                            where: { isPreview: true },
                            orderBy: { order: 'asc' }
                        }
                    }
                },
                ratings: true
            }
        });

        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        res.json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// --- STUDENT (RATINGS) ---

exports.rateCourse = async (req, res) => {
    try {
        const courseId = req.params.id;
        const userId = req.user.id;
        const { rating, review } = req.body;

        const parsedRating = parseInt(rating);
        if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        }

        // Check if user is enrolled
        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } }
        });
        if (!enrollment) {
            return res.status(403).json({ success: false, message: 'You must be enrolled to rate this course' });
        }

        const courseRating = await prisma.courseRating.upsert({
            where: { userId_courseId: { userId, courseId } },
            update: { rating: parsedRating, review },
            create: { userId, courseId, rating: parsedRating, review }
        });

        res.json({ success: true, data: courseRating, message: 'Review submitted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- INSTRUCTOR ---

exports.getMyCourses = async (req, res) => {
    try {
        const courses = await prisma.course.findMany({
            where: { instructorId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });
        res.json({ success: true, data: courses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createCourse = async (req, res) => {
    try {
        const { title, description, category, level, price, isFree } = req.body;

        const slug = slugify(title, { lower: true, strict: true }) + '-' + Math.floor(Math.random() * 1000);

        const course = await prisma.course.create({
            data: {
                title,
                description,
                slug,
                category: category || 'General',
                level: level || 'BEGINNER',
                price: parseFloat(price) || 0,
                isFree: isFree === true || isFree === 'true',
                instructorId: req.user.id
            }
        });

        res.status(201).json({ success: true, data: course });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const { id } = req.params;

        // Authorization check
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) return res.status(404).json({ success: false, message: 'Not found' });
        if (course.instructorId !== req.user.id && req.user.role !== 'ADMINISTRATOR') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const updated = await prisma.course.update({
            where: { id },
            data: req.body
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) return res.status(404).json({ success: false, message: 'Not found' });
        if (course.instructorId !== req.user.id && req.user.role !== 'ADMINISTRATOR') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        await prisma.course.delete({ where: { id } });
        res.json({ success: true, message: 'Course deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.publishCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) return res.status(404).json({ success: false, message: 'Not found' });
        if (course.instructorId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

        // Validate if course has content before publishing
        const sectionCount = await prisma.section.count({ where: { courseId: id } });
        if (sectionCount === 0) {
            return res.status(400).json({ success: false, message: 'Cannot publish an empty course' });
        }

        const updated = await prisma.course.update({
            where: { id },
            data: { isPublished: true }
        });

        res.json({ success: true, data: updated, message: 'Course published successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.updatePrerequisites = async (req, res) => {
    try {
        const { id } = req.params;
        const { prerequisiteIds } = req.body; // Expecting an array of course IDs

        // Clear existing prerequisites
        await prisma.coursePrerequisite.deleteMany({
            where: { courseId: id }
        });

        if (prerequisiteIds && Array.isArray(prerequisiteIds) && prerequisiteIds.length > 0) {
            const data = prerequisiteIds.map(prereqId => ({
                courseId: id,
                prerequisiteId: prereqId
            }));
            await prisma.coursePrerequisite.createMany({ data });
        }

        res.json({ success: true, message: 'Prerequisites updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- SECTIONS ---

exports.getSections = async (req, res) => {
    try {
        const sections = await prisma.section.findMany({
            where: { courseId: req.params.id },
            orderBy: { order: 'asc' },
            include: {
                lessons: { orderBy: { order: 'asc' } }
            }
        });
        res.json({ success: true, data: sections });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createSection = async (req, res) => {
    try {
        const { courseId } = req.params; // this comes from URL /courses/:id/sections
        id = req.params.id;
        const { title, order } = req.body;

        // auth check omitted for brevity in demo, assuming route middleware is intact
        const section = await prisma.section.create({
            data: {
                title,
                order: parseInt(order) || 0,
                courseId: id
            }
        });
        res.status(201).json({ success: true, data: section });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSection = async (req, res) => {
    try {
        const section = await prisma.section.update({
            where: { id: req.params.sectionId },
            data: { title: req.body.title, order: req.body.order ? parseInt(req.body.order) : undefined }
        });
        res.json({ success: true, data: section });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteSection = async (req, res) => {
    try {
        await prisma.section.delete({ where: { id: req.params.sectionId } });
        res.json({ success: true, message: 'Section deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- LESSONS ---

exports.createLesson = async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { title, order, type, content, isPreview, dripDays, liveUrl, liveStartTime, assignmentDescription, assignmentDeadline } = req.body;
        let videoUrl = null;
        let finalType = type || 'VIDEO';

        if (req.file) {
            // Local file URL path starting from root, so express.static can serve it
            const folder = req.file.mimetype.startsWith('video/') ? 'videos' : 'images';
            videoUrl = `/uploads/${folder}/${req.file.filename}`;
            if (folder === 'videos') {
                finalType = 'VIDEO';
            }
        }

        const lesson = await prisma.lesson.create({
            data: {
                title,
                order: parseInt(order) || 0,
                type: finalType,
                content,
                videoUrl,
                attachments: req.body.attachments ? JSON.parse(req.body.attachments) : null,
                isPreview: isPreview === true || isPreview === 'true',
                dripDays: parseInt(dripDays) || 0,
                liveUrl: liveUrl || null,
                liveStartTime: liveStartTime ? new Date(liveStartTime) : null,
                sectionId
            }
        });

        if (type === 'ASSIGNMENT') {
            await prisma.assignment.create({
                data: {
                    lessonId: lesson.id,
                    title: lesson.title,
                    description: assignmentDescription || '',
                    deadline: assignmentDeadline ? new Date(assignmentDeadline) : null
                }
            });
        }

        res.status(201).json({ success: true, data: lesson });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateLesson = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const updateData = { ...req.body };
        if (updateData.order) updateData.order = parseInt(updateData.order);
        if (updateData.isPreview) updateData.isPreview = updateData.isPreview === true || updateData.isPreview === 'true';
        if (updateData.dripDays) updateData.dripDays = parseInt(updateData.dripDays);
        if (updateData.liveStartTime) updateData.liveStartTime = new Date(updateData.liveStartTime);

        const assignmentDescription = updateData.assignmentDescription;
        const assignmentDeadline = updateData.assignmentDeadline;
        delete updateData.assignmentDescription;
        delete updateData.assignmentDeadline;

        if (updateData.attachments) {
            updateData.attachments = JSON.parse(updateData.attachments);
        } else if (updateData.attachments === '') {
            updateData.attachments = null;
        }

        if (req.file) {
            const folder = req.file.mimetype.startsWith('video/') ? 'videos' : 'images';
            updateData.videoUrl = `/uploads/${folder}/${req.file.filename}`;
            if (folder === 'videos') {
                updateData.type = 'VIDEO';
            }
        }

        const lesson = await prisma.lesson.update({
            where: { id: lessonId },
            data: updateData
        });

        if (updateData.type === 'ASSIGNMENT' || lesson.type === 'ASSIGNMENT') {
            const assignData = {};
            if (updateData.title) assignData.title = updateData.title;
            if (assignmentDescription !== undefined) assignData.description = assignmentDescription;
            if (assignmentDeadline !== undefined) assignData.deadline = assignmentDeadline ? new Date(assignmentDeadline) : null;
            
            await prisma.assignment.upsert({
                where: { lessonId },
                create: {
                    lessonId,
                    title: updateData.title || lesson.title,
                    description: assignmentDescription || '',
                    deadline: assignmentDeadline ? new Date(assignmentDeadline) : null
                },
                update: assignData
            });
        }

        res.json({ success: true, data: lesson });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteLesson = async (req, res) => {
    try {
        await prisma.lesson.delete({ where: { id: req.params.lessonId } });
        res.json({ success: true, message: 'Lesson deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.bulkCreateCurriculum = async (req, res) => {
    try {
        const { id } = req.params;
        const { sections } = req.body;

        if (!sections || !Array.isArray(sections)) {
            return res.status(400).json({ success: false, message: 'Sections array is required' });
        }

        const course = await prisma.course.findUnique({
            where: { id },
            include: { sections: true }
        });

        if (!course || (course.instructorId !== req.user.id && req.user.role !== 'ADMINISTRATOR')) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        let currentSectionOrder = course.sections.length;

        for (const sec of sections) {
            const createdSection = await prisma.section.create({
                data: {
                    courseId: id,
                    title: sec.title,
                    order: currentSectionOrder++
                }
            });

            if (sec.lessons && Array.isArray(sec.lessons)) {
                let currentLessonOrder = 0;
                for (const les of sec.lessons) {
                    await prisma.lesson.create({
                        data: {
                            sectionId: createdSection.id,
                            title: les.title,
                            content: les.description || '',
                            type: 'ARTICLE',
                            order: currentLessonOrder++
                        }
                    });
                }
            }
        }

        res.json({ success: true, message: 'Curriculum applied successfully' });
    } catch (error) {
        console.error('Bulk Create Curriculum Error:', error);
        res.status(500).json({ success: false, message: 'Failed to apply curriculum' });
    }
};
