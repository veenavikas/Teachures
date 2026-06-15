const cron = require('node-cron');
const prisma = require('../config/database');
const { sendEmail } = require('./email.service');

// Initialize Cron Jobs
exports.initCronJobs = () => {
    // Run daily at 09:00 AM
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily cron jobs...');
        await sendWeMissYouEmails();
    });

    console.log('Cron jobs initialized.');
};

async function sendWeMissYouEmails() {
    try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Find users who haven't logged in since 7 days ago and are enrolled in at least one course
        const inactiveUsers = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                // Assuming we track lastLogin or lastAccessed. We have courseProgress.lastAccessed.
                progress: {
                    some: {
                        lastAccessed: { lte: sevenDaysAgo }
                    }
                }
            },
            include: {
                progress: {
                    where: { lastAccessed: { lte: sevenDaysAgo } },
                    include: { course: true },
                    take: 1
                }
            }
        });

        for (const user of inactiveUsers) {
            const courseName = user.progress[0]?.course?.title || 'your courses';
            
            const htmlContent = `
                <h2>We miss you, ${user.name}!</h2>
                <p>It's been a while since you last studied <strong>${courseName}</strong>. Log in today to continue your learning journey.</p>
                <a href="${process.env.APP_URL}/login" style="padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">Resume Learning</a>
            `;

            await sendEmail(user.email, 'Continue your learning journey on Teachures!', htmlContent);
        }
        console.log(`Sent "We miss you" emails to ${inactiveUsers.length} users.`);
    } catch (error) {
        console.error('Error in sendWeMissYouEmails cron:', error);
    }
}
