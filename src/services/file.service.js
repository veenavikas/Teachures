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
exports.generateSignedUrl = async (key, expiresIn = 7200) => {
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const secret = process.env.SESSION_SECRET || 'fallback-secret-teachures-dev';
    const payload = `${key}:${expires}`;
    
    const signature = crypto.createHmac('sha256', secret)
                            .update(payload)
                            .digest('hex');
                            
    return `/student/videos/stream?file=${encodeURIComponent(key)}&expires=${expires}&signature=${signature}`;
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
