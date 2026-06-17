const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

// Configure Nodemailer Transport
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Render EJS template and send email
 */
const sendHtmlEmail = async (to, subject, templateName, context) => {
    try {
        const templatePath = path.join(__dirname, '../views/emails', `${templateName}.ejs`);
        const layoutPath = path.join(__dirname, '../views/emails', 'layout.ejs');

        // Render inner content
        const bodyContent = await ejs.renderFile(templatePath, context);
        
        // Render layout with inner content
        const html = await ejs.renderFile(layoutPath, { body: bodyContent });

        const mailOptions = {
            from: process.env.SMTP_FROM || '"Teachures" <noreply@teachures.com>',
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email send error:', error);
        return false;
    }
};

exports.sendWelcomeEmail = async (to, name) => {
    const context = { name, url: process.env.APP_URL || 'http://localhost:3000' };
    return await sendHtmlEmail(to, 'Welcome to Teachures!', 'welcome', context);
};

exports.sendEnrollmentEmail = async (to, name, courseTitle, amount) => {
    const context = { name, courseTitle, amount, url: process.env.APP_URL || 'http://localhost:3000' };
    return await sendHtmlEmail(to, `Enrollment Confirmed: ${courseTitle}`, 'enrollment', context);
};

exports.sendForgotPasswordEmail = async (to, name, resetToken) => {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const context = { name, resetUrl: `${baseUrl}/reset-password?token=${resetToken}` };
    return await sendHtmlEmail(to, 'Password Reset Request', 'forgot-password', context);
};

exports.sendResetSuccessEmail = async (to, name) => {
    const context = { name, url: process.env.APP_URL || 'http://localhost:3000' };
    return await sendHtmlEmail(to, 'Password Reset Successful', 'reset-success', context);
};

exports.sendVerifyEmail = async (to, name, verifyToken) => {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const context = { name, verifyUrl: `${baseUrl}/verify-email?token=${verifyToken}` };
    return await sendHtmlEmail(to, 'Verify Your Email Address', 'verify-email', context);
};
