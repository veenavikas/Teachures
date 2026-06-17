const { Queue, Worker } = require('bullmq');
const { sendEmail } = require('./email.service');

const connection = process.env.REDIS_URL 
    ? new URL(process.env.REDIS_URL) 
    : {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
    };

// BullMQ supports passing a Redis instance or a connection object, but if REDIS_URL is provided, 
// we should map it to the object format it expects:
const redisConnectionConfig = process.env.REDIS_URL ? {
    host: connection.hostname,
    port: connection.port || 6379,
    password: connection.password || undefined
} : connection;

// Create Email Queue
const emailQueue = new Queue('emailQueue', { connection: redisConnectionConfig });

// Worker to process emails
const emailWorker = new Worker('emailQueue', async (job) => {
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

exports.enqueueEmail = async (to, subject, text, html) => {
    await emailQueue.add('sendEmail', { to, subject, text, html }, {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    });
};
