const sgMail = require('@sendgrid/mail');

// Set the SendGrid API Key from environment variables
sgMail.setApiKey(process.env.SENDGRID_API_KEY || 'dummy_api_key');

/**
 * Send an email using SendGrid
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text body
 * @param {string} html - HTML body (optional)
 */
exports.sendEmail = async (to, subject, text, html) => {
    const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@teachures.com', // Change to your verified sender
        subject,
        text,
        html: html || text, // Fallback to text if html is not provided
    };

    try {
        await sgMail.send(msg);
        console.log(`Email sent to ${to}`);
        return true;
    } catch (error) {
        console.error('SendGrid Error:', error);
        if (error.response) {
            console.error(error.response.body);
        }
        return false;
    }
};

/**
 * Template: Welcome Email
 */
exports.sendWelcomeEmail = async (to, name) => {
    const subject = 'Welcome to Teachures!';
    const text = `Hi ${name},\n\nWelcome to Teachures. We are excited to have you on board!`;
    const html = `
    <div style="font-family: sans-serif; color: #333;">
      <h2 style="color: #F5C518;">Welcome to Teachures!</h2>
      <p>Hi ${name},</p>
      <p>Welcome to Teachures. We are excited to have you on board to start learning or teaching.</p>
      <p>Best,<br/>The Teachures Team</p>
    </div>
  `;
    return await this.sendEmail(to, subject, text, html);
};

/**
 * Template: Course Enrollment Receipt
 */
exports.sendEnrollmentEmail = async (to, name, courseTitle, amount) => {
    const subject = `Enrollment Confirmed: ${courseTitle}`;
    const text = `Hi ${name},\n\nYou have successfully enrolled in ${courseTitle} for $${amount}.\nEnjoy learning!`;
    const html = `
    <div style="font-family: sans-serif; color: #333;">
      <h2 style="color: #F5C518;">Enrollment Confirmed</h2>
      <p>Hi ${name},</p>
      <p>You have successfully enrolled in <strong>${courseTitle}</strong> for $${amount}.</p>
      <p>Click <a href="http://localhost:3000/learner/dashboard">here</a> to start learning.</p>
      <p>Best,<br/>The Teachures Team</p>
    </div>
  `;
    return await this.sendEmail(to, subject, text, html);
};
