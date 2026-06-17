const express = require('express');
const router = express.Router();
const prisma = require('../../config/database');
const { requireAuth } = require('../../middleware/auth.middleware');

// GET all categories for the tenant
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.communityCategory.findMany({
            where: { tenantId: req.tenant.id },
            include: { _count: { select: { topics: true } } },
            orderBy: { order: 'asc' }
        });
        res.json({ success: true, data: categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST a new topic
router.post('/topics', requireAuth, async (req, res) => {
    try {
        const { categoryId, title, content } = req.body;
        const topic = await prisma.communityTopic.create({
            data: {
                categoryId,
                authorId: req.user.id,
                title,
                content
            }
        });
        res.status(201).json({ success: true, data: topic });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST a reply
router.post('/topics/:topicId/replies', requireAuth, async (req, res) => {
    try {
        const { content } = req.body;
        const { topicId } = req.params;

        const reply = await prisma.communityReply.create({
            data: {
                topicId,
                authorId: req.user.id,
                content
            }
        });

        // Update topic last updated time
        await prisma.communityTopic.update({
            where: { id: topicId },
            data: { updatedAt: new Date() }
        });

        res.status(201).json({ success: true, data: reply });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
