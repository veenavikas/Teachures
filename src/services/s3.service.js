const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, S3_BUCKET } = require('../config/s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require('crypto');

/**
 * Upload buffer to S3
 */
exports.uploadFileToS3 = async (fileBuffer, originalName, mimeType, folder = 'uploads') => {
    const fileExt = originalName.split('.').pop();
    const randomName = crypto.randomBytes(16).toString('hex');
    const key = `${folder}/${randomName}.${fileExt}`;

    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: mimeType,
        // ACL: 'private' // default is private
    });

    await s3Client.send(command);

    return key; // Return the S3 key, not the full public URL, to ensure secure access via signed URLs
};

/**
 * Generate a pre-signed URL for secure viewing (e.g. video playback)
 */
exports.generateSignedUrl = async (key, expiresInSeconds = 3600) => {
    const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key
    });

    // Creates a URL that expires in defined seconds (default 1 hour)
    const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
    return url;
};

/**
 * Delete file from S3
 */
exports.deleteFileFromS3 = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key
    });

    await s3Client.send(command);
    return true;
};
