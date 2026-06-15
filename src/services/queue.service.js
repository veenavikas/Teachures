const { Queue, Worker } = require('bullmq');
const { sendEmail } = require('./email.service');

const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined
};

// Create Email Queue
const emailQueue = new Queue('emailQueue', { connection });

// Worker to process emails
const emailWorker = new Worker('emailQueue', async (job) => {
    const { to, subject, text, html } = job.data;
    console.log(`Processing email job ${job.id} for ${to}`);
    await sendEmail(to, subject, text, html);
}, { connection });

emailWorker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
});

emailWorker.on('failed', (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`);
});

exports.enqueueEmail = async (to, subject, text, html) => {
    await emailQueue.add('sendEmail', { to, subject, text, html }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    });
};
