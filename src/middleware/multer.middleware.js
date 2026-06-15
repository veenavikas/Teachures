const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Configure multer to store files on the local disk
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, path.join(__dirname, '../public/uploads/videos'));
        } else if (file.mimetype.startsWith('image/')) {
            cb(null, path.join(__dirname, '../public/uploads/images'));
        } else {
            cb(null, path.join(__dirname, '../public/uploads'));
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(8).toString('hex') + '-' + Date.now();
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

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
