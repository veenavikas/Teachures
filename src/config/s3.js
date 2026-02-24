const { S3Client } = require('@aws-sdk/client-s3');

// S3 Configuration using v3 AWS SDK
const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy_key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy_secret'
    }
});

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || 'teachures-assets';

module.exports = { s3Client, S3_BUCKET };
