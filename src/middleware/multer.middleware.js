const multer = require('multer');

// Configure multer to store files in memory for S3 uploading
const storage = multer.memoryStorage();

// Basic file filter for videos and images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only videos and images are allowed.'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

module.exports = upload;
