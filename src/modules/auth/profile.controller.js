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

exports.updatePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.password) {
            return res.status(400).json({ success: false, message: 'User does not have a local password to change. Try using Forgot Password.' });
        }

        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Incorrect current password' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
