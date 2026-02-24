const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/auth.middleware');
const paypalClient = require('../../config/paypal').client;
const paypal = require('@paypal/checkout-server-sdk');
const { sendEnrollmentEmail } = require('../../services/email.service');
const { createNotification } = require('../notifications/notifications.controller');

// POST /api/v1/payments/create-order
router.post('/create-order', requireAuth, async (req, res) => {
    try {
        const { courseId } = req.body;

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        if (course.isFree) return res.status(400).json({ success: false, message: 'Course is free' });

        // Check if already enrolled
        const existing = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId } }
        });
        if (existing) return res.status(400).json({ success: false, message: 'Already enrolled' });

        let request = new paypal.orders.OrdersCreateRequest();
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: course.price.toString()
                },
                description: `Enrollment in ${course.title}`,
                custom_id: `${req.user.id}|${courseId}` // Store tracking data
            }]
        });

        const response = await paypalClient.execute(request);

        // Save pending payment record locally
        await prisma.payment.create({
            data: {
                userId: req.user.id,
                paypalPaymentId: response.result.id, // Order ID from PayPal
                amount: course.price,
                status: 'PENDING'
            }
        });

        res.json({ success: true, orderID: response.result.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to create order' });
    }
});

// POST /api/v1/payments/capture-order
router.post('/capture-order', requireAuth, async (req, res) => {
    try {
        const { orderID } = req.body;

        let request = new paypal.orders.OrdersCaptureRequest(orderID);
        request.requestBody({});

        const capture = await paypalClient.execute(request);

        if (capture.result.status === 'COMPLETED') {
            const customId = capture.result.purchase_units[0].custom_id;
            const [userId, courseId] = customId.split('|');

            // 1. Update Payment Status
            const payment = await prisma.payment.update({
                where: { paypalPaymentId: orderID },
                data: { status: 'COMPLETED' }
            });

            // 2. Create Enrollment
            await prisma.enrollment.create({
                data: {
                    userId,
                    courseId,
                    paymentId: payment.id
                }
            });

            // 3. Init Course Progress
            await prisma.courseProgress.create({
                data: { userId, courseId }
            });

            // 4. Send Receipt Email & Push Notification
            try {
                const course = await prisma.course.findUnique({ where: { id: courseId } });
                if (course) {
                    await sendEnrollmentEmail(req.user.email, req.user.name, course.title, course.price);
                    await createNotification(
                        userId,
                        'Enrollment Successful! 🎉',
                        `You have successfully enrolled in "${course.title}". Head to your dashboard to start learning.`,
                        `/courses/${course.slug}`
                    );
                }
            } catch (err) {
                console.error('Failed to send receipt or notification:', err);
            }

            res.json({ success: true, message: 'Payment successful, enrolled in course.' });
        } else {
            res.status(400).json({ success: false, message: 'Payment not completed.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to capture order' });
    }
});

module.exports = router;
