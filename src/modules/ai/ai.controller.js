const Groq = require('groq-sdk');
const prisma = require('../../config/database');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key'
});

exports.askTutor = async (req, res) => {
    try {
        const { question, courseId, lessonId } = req.body;
        if (!question) {
            return res.status(400).json({ success: false, message: 'Question is required' });
        }

        let context = 'You are a helpful and encouraging AI teaching assistant for the Teachures LMS.';

        // If course info is provided, fetch some context
        if (courseId) {
            const course = await prisma.course.findUnique({ where: { id: courseId } });
            if (course) {
                context += ` You are helping a student in the course "${course.title}". Course description: ${course.description}`;
            }
        }

        if (lessonId) {
            const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
            if (lesson) {
                context += ` They are currently studying the lesson "${lesson.title}".`;
            }
        }

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: context },
                { role: 'user', content: question }
            ],
            model: 'llama3-8b-8192',
            temperature: 0.7,
            max_tokens: 512
        });

        const reply = chatCompletion.choices[0]?.message?.content || 'I am sorry, I am currently unable to answer that.';

        res.json({ success: true, reply });
    } catch (error) {
        console.error('Groq AI Error:', error);
        res.status(500).json({ success: false, message: error.message || 'AI request failed' });
    }
};
