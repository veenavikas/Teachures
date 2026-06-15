const prisma = require('../../config/database');

exports.createCoupon = async (req, res) => {
    try {
        const { code, discountPercentage, discountAmount, maxUses, expiresAt, courseId } = req.body;

        // Verify instructor owns the course if courseId is provided
        if (courseId && req.user.role === 'INSTRUCTOR') {
            const course = await prisma.course.findUnique({ where: { id: courseId } });
            if (!course || course.instructorId !== req.user.id) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }
        }

        const coupon = await prisma.coupon.create({
            data: {
                code: code.toUpperCase(),
                discountPercentage: discountPercentage ? parseFloat(discountPercentage) : null,
                discountAmount: discountAmount ? parseFloat(discountAmount) : null,
                maxUses: maxUses ? parseInt(maxUses) : null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                courseId: courseId || null
            }
        });

        res.status(201).json({ success: true, data: coupon });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ success: false, message: 'Coupon code already exists' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.validateCoupon = async (req, res) => {
    try {
        const { code, courseId } = req.body;

        const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

        if (!coupon) return res.status(404).json({ success: false, message: 'Invalid coupon code' });

        if (coupon.expiresAt && new Date() > coupon.expiresAt) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }

        if (coupon.maxUses && coupon.usesCount >= coupon.maxUses) {
            return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
        }

        if (coupon.courseId && coupon.courseId !== courseId) {
            return res.status(400).json({ success: false, message: 'Coupon is not valid for this course' });
        }

        res.json({ success: true, data: {
            discountPercentage: coupon.discountPercentage,
            discountAmount: coupon.discountAmount
        }});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
