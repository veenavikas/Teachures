const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Save buffer to Local Filesystem
 */
exports.uploadFileLocal = async (fileBuffer, originalName, mimeType, folder = 'uploads') => {
    const fileExt = originalName.split('.').pop();
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}.${fileExt}`;
    
    // Determine target directory
    const targetDir = path.join(__dirname, `../public/uploads/${folder}`);
    
    // Ensure directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const targetPath = path.join(targetDir, filename);
    
    // Write the buffer to the file
    fs.writeFileSync(targetPath, fileBuffer);

    return `/uploads/${folder}/${filename}`; // Return relative path to serve statically
};

/**
 * Generate a Local URL (Replacing S3 Signed URLs)
 */
exports.generateSignedUrl = async (key) => {
    // For local storage, the key is already a relative URL like /uploads/videos/xxx.mp4
    // We just return it. No presigning needed.
    return key;
};

/**
 * Delete file from Local Filesystem
 */
exports.deleteFileLocal = async (key) => {
    try {
        // key is something like /uploads/videos/xxx.mp4
        const targetPath = path.join(__dirname, '../public', key);
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }
        return true;
    } catch (err) {
        console.error('File deletion error:', err);
        return false;
    }
};
