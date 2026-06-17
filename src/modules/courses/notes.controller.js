const prisma = require('../../config/database');

exports.createNote = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { content, timestamp } = req.body;

        const note = await prisma.note.create({
            data: {
                userId: req.user.id,
                lessonId,
                content,
                timestamp: timestamp ? parseInt(timestamp, 10) : null
            }
        });

        res.status(201).json({ success: true, data: note });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getNotes = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const notes = await prisma.note.findMany({
            where: {
                lessonId,
                userId: req.user.id
            },
            orderBy: { timestamp: 'asc' } // Show in chronological order of the video
        });

        res.json({ success: true, data: notes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteNote = async (req, res) => {
    try {
        const { noteId } = req.params;
        
        const note = await prisma.note.findUnique({ where: { id: noteId } });
        if (!note) return res.status(404).json({ success: false, message: 'Note not found' });
        
        if (note.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        await prisma.note.delete({ where: { id: noteId } });
        res.json({ success: true, message: 'Note deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
