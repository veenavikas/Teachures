const prisma = require('../../config/database');
const fs = require('fs');
const path = require('path');

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;
        
        let avatarUrl = req.user.avatar; // Keep existing if not updated

        if (req.file) {
            // In a real production app, upload to S3. Here we store locally.
            avatarUrl = '/uploads/avatars/' + req.file.filename;
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { 
                name: name || req.user.name,
                avatar: avatarUrl 
            }
        });

        res.json({ success: true, data: { name: user.name, avatar: user.avatar } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true }
        });
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
