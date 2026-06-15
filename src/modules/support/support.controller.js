const prisma = require('../../config/database');

exports.getMyTickets = async (req, res) => {
    try {
        const tickets = await prisma.supportTicket.findMany({
            where: { userId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });

        // Return JSON if API request
        if (req.headers['accept'] === 'application/json') {
            return res.json({ success: true, data: tickets });
        }

        // Render EJS view otherwise
        res.render('learner/support', {
            layout: 'layouts/dashboard',
            title: 'Support Center',
            path: req.originalUrl,
            user: req.user,
            sidebarPartial: '../partials/sidebar-learner',
            tickets
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTicket = async (req, res) => {
    try {
        const ticket = await prisma.supportTicket.findUnique({
            where: { id: req.params.id },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

        // Security check: Only owners or Admins can view
        if (ticket.userId !== req.user.id && req.user.role !== 'ADMINISTRATOR') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        res.json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createTicket = async (req, res) => {
    try {
        const { subject, description, priority } = req.body;

        const ticket = await prisma.supportTicket.create({
            data: {
                userId: req.user.id,
                subject,
                description,
                priority: priority || 'MEDIUM',
                status: 'OPEN'
            }
        });

        // Add initial description as the first message
        await prisma.ticketMessage.create({
            data: {
                ticketId: ticket.id,
                senderId: req.user.id,
                message: description
            }
        });

        res.status(201).json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        const ticket = await prisma.supportTicket.findUnique({ where: { id } });
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

        if (ticket.userId !== req.user.id && req.user.role !== 'ADMINISTRATOR') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const ticketMessage = await prisma.ticketMessage.create({
            data: {
                ticketId: id,
                senderId: req.user.id,
                message
            }
        });

        // Update ticket updated_at
        await prisma.supportTicket.update({
            where: { id },
            data: { updatedAt: new Date() } // Trigger updatedAt
        });

        res.status(201).json({ success: true, data: ticketMessage });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Enum: OPEN, IN_PROGRESS, RESOLVED, CLOSED
        const ticket = await prisma.supportTicket.update({
            where: { id },
            data: { status }
        });

        res.json({ success: true, data: ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
