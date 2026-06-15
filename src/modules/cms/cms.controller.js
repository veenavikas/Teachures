const prisma = require('../../config/database');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const slugify = require('slugify');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

// --- ADMIN CMS ENDPOINTS ---

exports.getAllPages = async (req, res) => {
    try {
        const pages = await prisma.page.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, data: pages });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPageById = async (req, res) => {
    try {
        const page = await prisma.page.findUnique({ where: { id: req.params.id } });
        if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
        res.json({ success: true, data: page });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createPage = async (req, res) => {
    try {
        const { title, content, seoTitle, seoDesc, isDraft } = req.body;
        
        let slug = req.body.slug;
        if (!slug) {
            slug = slugify(title, { lower: true, strict: true });
        }

        // Ensure unique slug
        let existing = await prisma.page.findUnique({ where: { slug } });
        if (existing) {
            slug = slug + '-' + Date.now();
        }

        // Sanitize HTML input to prevent XSS
        const cleanContent = purify.sanitize(content);

        const page = await prisma.page.create({
            data: {
                title,
                slug,
                content: cleanContent,
                seoTitle,
                seoDesc,
                isDraft: isDraft === true || isDraft === 'true'
            }
        });

        res.status(201).json({ success: true, data: page });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePage = async (req, res) => {
    try {
        const { title, slug, content, seoTitle, seoDesc, isDraft } = req.body;

        const updateData = {};
        if (title) updateData.title = title;
        if (slug) updateData.slug = slug;
        if (content) updateData.content = purify.sanitize(content);
        if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
        if (seoDesc !== undefined) updateData.seoDesc = seoDesc;
        if (isDraft !== undefined) updateData.isDraft = isDraft === true || isDraft === 'true';

        const page = await prisma.page.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json({ success: true, data: page });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deletePage = async (req, res) => {
    try {
        await prisma.page.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Page deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- PUBLIC CMS ENDPOINTS ---

exports.getPublicPageBySlug = async (req, res) => {
    try {
        const page = await prisma.page.findUnique({ where: { slug: req.params.slug } });
        
        if (!page || page.isDraft) {
            return res.status(404).json({ success: false, message: 'Page not found' });
        }

        res.json({ success: true, data: page });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
