const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { uploadFileToS3 } = require('./s3.service');

/**
 * Generate a PDF Certificate and upload to S3
 * @param {Object} data - Context data for certificate
 * @param {string} data.studentName
 * @param {string} data.courseTitle
 * @param {string} data.date
 * @param {string} data.verifyCode
 * @returns {Promise<string>} S3 URL of the uploaded certificate
 */
exports.generateCertificate = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                layout: 'landscape',
                size: 'A4',
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', async () => {
                const pdfData = Buffer.concat(buffers);

                // Upload to S3
                const fileName = `cert-${data.verifyCode}.pdf`;
                const s3Key = await uploadFileToS3(pdfData, fileName, 'application/pdf', 'certificates');

                resolve(s3Key);
            });

            // --- Draw Certificate ---
            const pageWidth = doc.page.width;

            // Border
            doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#F5C518');
            doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke('#3A3A3A');

            // Header
            doc.font('Helvetica-Bold').fontSize(30).fillColor('#0A0A0A')
                .text('CERTIFICATE OF COMPLETION', 0, 100, { align: 'center' });

            doc.font('Helvetica').fontSize(16).fillColor('#3A3A3A')
                .text('This is to certify that', 0, 150, { align: 'center' });

            // Student Name
            doc.font('Helvetica-Bold').fontSize(40).fillColor('#0A0A0A')
                .text(data.studentName, 0, 200, { align: 'center' });

            doc.font('Helvetica').fontSize(16).fillColor('#3A3A3A')
                .text('has successfully completed the course', 0, 260, { align: 'center' });

            // Course Title
            doc.font('Helvetica-Bold').fontSize(24).fillColor('#F5C518')
                .text(data.courseTitle, 0, 310, { align: 'center' });

            // Date and Verification
            doc.font('Helvetica').fontSize(12).fillColor('#3A3A3A')
                .text(`Date of Issue: ${data.date}`, 60, 480);

            doc.text(`Verify ID: ${data.verifyCode}`, 60, 500);

            // Signature placeholder
            doc.moveTo(doc.page.width - 250, 480).lineTo(doc.page.width - 60, 480).stroke('#0A0A0A');
            doc.font('Helvetica').fontSize(14).fillColor('#0A0A0A')
                .text('Teachures Academy', doc.page.width - 250, 490, { width: 190, align: 'center' });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};
