const prisma = require('../../config/database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

exports.generateCertificate = async (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user.id;

        // Verify enrollment and completion
        const enrollment = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId, courseId } },
            include: { user: true, course: true }
        });

        if (!enrollment) return res.status(403).json({ success: false, message: 'Not enrolled' });

        const progress = await prisma.courseProgress.findUnique({
            where: { userId_courseId: { userId, courseId } }
        });

        if (!progress || progress.percentComplete < 100) {
            return res.status(400).json({ success: false, message: 'Course not completed' });
        }

        // Check if certificate already exists
        let certificate = await prisma.certificate.findUnique({
            where: { userId_courseId: { userId, courseId } }
        });

        if (!certificate) {
            // Generate PDF
            const doc = new PDFDocument({
                layout: 'landscape',
                size: 'A4',
            });

            const fileName = `certificate_${userId}_${courseId}.pdf`;
            const certsPath = path.join(__dirname, '../../../public/certificates');
            if (!fs.existsSync(certsPath)) {
                fs.mkdirSync(certsPath, { recursive: true });
            }
            const filePath = path.join(certsPath, fileName);
            const pdfUrl = `/certificates/${fileName}`;

            doc.pipe(fs.createWriteStream(filePath));

            // Basic Certificate Design
            doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
            doc.fontSize(40).fillColor('#333').text('Certificate of Completion', { align: 'center', margin: 50 });
            doc.fontSize(20).text('This is to certify that', { align: 'center', margin: 20 });
            doc.fontSize(30).fillColor('#007bff').text(enrollment.user.name, { align: 'center', margin: 20 });
            doc.fontSize(20).fillColor('#333').text('has successfully completed the course', { align: 'center', margin: 20 });
            doc.fontSize(30).text(enrollment.course.title, { align: 'center', margin: 20 });
            doc.fontSize(15).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center', margin: 50 });

            doc.end();

            certificate = await prisma.certificate.create({
                data: {
                    userId,
                    courseId,
                    pdfUrl,
                    verifyCode: uuidv4()
                }
            });
        }

        res.json({ success: true, data: certificate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.verifyCertificate = async (req, res) => {
    try {
        const { verifyCode } = req.params;
        const certificate = await prisma.certificate.findUnique({
            where: { verifyCode },
            include: { user: { select: { name: true } }, course: { select: { title: true } } }
        });

        if (!certificate) return res.status(404).json({ success: false, message: 'Invalid certificate code' });

        res.json({ success: true, data: certificate });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
