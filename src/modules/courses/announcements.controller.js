const prisma = require('../../config/database');
const { enqueueEmail } = require('../../services/queue.service');

exports.createAnnouncement = async (req, res) => {
    try {
        const { id } = req.params; // courseId
        const { title, content } = req.body;

        const course = await prisma.course.findUnique({
            where: { id },
            include: { instructor: true }
        });

        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        if (course.instructorId !== req.user.id) return res.status(403).json({ success: false, message: 'Forbidden' });

        const announcement = await prisma.announcement.create({
            data: {
                courseId: id,
                title,
                content
            }
        });

        // Broadcast to enrolled students
        const enrollments = await prisma.enrollment.findMany({
            where: { courseId: id },
            include: { user: true }
        });

        const emails = enrollments.map(e => e.user.email);
        
        if (emails.length > 0) {
            // Send an email broadcast using the mailer utility
            const emailSubject = `New Announcement in ${course.title}: ${title}`;
            const emailHtml = `
                <h2>${title}</h2>
                <p>${content}</p>
                <p>Login to your dashboard to view the course.</p>
                <br>
                <small>Sent by ${course.instructor.name}</small>
            `;
            
            // In a real production app, we would queue this.
            for (const email of emails) {
                enqueueEmail(email, emailSubject, '', emailHtml)
                    .catch(err => console.error("Broadcast email failed:", err));
            }
        }

        res.status(201).json({ success: true, data: announcement });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAnnouncements = async (req, res) => {
    try {
        const { id } = req.params;
        const announcements = await prisma.announcement.findMany({
            where: { courseId: id },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: announcements });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
