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
        const { courseId, couponCode } = req.body;

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
        if (course.isFree) return res.status(400).json({ success: false, message: 'Course is free' });

        // Check if already enrolled
        const existing = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId } }
        });
        if (existing) return res.status(400).json({ success: false, message: 'Already enrolled' });

        let finalPrice = course.price;
        let appliedCouponId = null;

        if (couponCode) {
            const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
            if (coupon && (!coupon.expiresAt || new Date() <= coupon.expiresAt) && (!coupon.maxUses || coupon.usesCount < coupon.maxUses) && (!coupon.courseId || coupon.courseId === courseId)) {
                if (coupon.discountPercentage) {
                    finalPrice = finalPrice * (1 - (coupon.discountPercentage / 100));
                } else if (coupon.discountAmount) {
                    finalPrice = Math.max(0, finalPrice - coupon.discountAmount);
                }
                appliedCouponId = coupon.id;
            }
        }

        let request = new paypal.orders.OrdersCreateRequest();
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'USD',
                    value: finalPrice.toFixed(2)
                },
                description: `Enrollment in ${course.title}`,
                custom_id: `${req.user.id}|${courseId}|${appliedCouponId || ''}` // Store tracking data
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
            const [userId, courseId, appliedCouponId] = customId.split('|');

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

            if (appliedCouponId) {
                await prisma.coupon.update({
                    where: { id: appliedCouponId },
                    data: { usesCount: { increment: 1 } }
                });
            }

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

// POST /api/v1/payments/mock-checkout (For demo/enterprise flow)
router.post('/mock-checkout', requireAuth, async (req, res) => {
    try {
        const { courseId, couponCode } = req.body;

        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

        const existing = await prisma.enrollment.findUnique({
            where: { userId_courseId: { userId: req.user.id, courseId } }
        });
        if (existing) return res.status(400).json({ success: false, message: 'Already enrolled' });

        let finalPrice = course.price;
        let appliedCouponId = null;

        if (couponCode) {
            const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
            if (coupon && (!coupon.expiresAt || new Date() <= coupon.expiresAt) && (!coupon.maxUses || coupon.usesCount < coupon.maxUses) && (!coupon.courseId || coupon.courseId === courseId)) {
                if (coupon.discountPercentage) {
                    finalPrice = finalPrice * (1 - (coupon.discountPercentage / 100));
                } else if (coupon.discountAmount) {
                    finalPrice = Math.max(0, finalPrice - coupon.discountAmount);
                }
                appliedCouponId = coupon.id;
            }
        }

        // Mock a successful payment
        const payment = await prisma.payment.create({
            data: {
                userId: req.user.id,
                paypalPaymentId: 'MOCK_PAY_' + Date.now(),
                amount: finalPrice,
                status: 'COMPLETED'
            }
        });

        await prisma.enrollment.create({
            data: {
                userId: req.user.id,
                courseId,
                paymentId: payment.id
            }
        });

        if (appliedCouponId) {
            await prisma.coupon.update({
                where: { id: appliedCouponId },
                data: { usesCount: { increment: 1 } }
            });
        }

        await prisma.courseProgress.create({
            data: { userId: req.user.id, courseId }
        });

        res.json({ success: true, message: 'Mock payment successful' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to process mock checkout' });
    }
});

module.exports = router;
