const { Queue, Worker } = require('bullmq');
const { sendEmail } = require('./email.service');

const USE_REDIS = process.env.USE_REDIS === 'true';

let emailQueue;
let emailWorker;

if (USE_REDIS) {
    const connection = process.env.REDIS_URL 
        ? new URL(process.env.REDIS_URL) 
        : {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || undefined
        };

    const redisConnectionConfig = process.env.REDIS_URL ? {
        host: connection.hostname,
        port: connection.port || 6379,
        password: connection.password || undefined
    } : connection;

    // Create Email Queue
    emailQueue = new Queue('emailQueue', { connection: redisConnectionConfig });

    // Worker to process emails
    emailWorker = new Worker('emailQueue', async (job) => {
        const { to, subject, text, html } = job.data;
        console.log(`Processing email job ${job.id} for ${to}`);
        await sendEmail(to, subject, text, html);
    }, { connection: redisConnectionConfig });

    emailWorker.on('completed', (job) => {
        console.log(`Job ${job.id} has completed!`);
    });

    emailWorker.on('failed', (job, err) => {
        console.log(`Job ${job.id} has failed with ${err.message}`);
    });
}

exports.enqueueEmail = async (to, subject, text, html) => {
    if (USE_REDIS && emailQueue) {
        await emailQueue.add('sendEmail', { to, subject, text, html }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });
    } else {
        // Fallback: synchronous sending when Redis is disabled
        console.log(`Redis is disabled. Sending email directly to ${to}`);
        await sendEmail(to, subject, text, html);
    }
};
