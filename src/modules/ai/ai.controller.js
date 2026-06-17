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

exports.generateCurriculum = async (req, res) => {
    try {
        const { courseId, prompt } = req.body;
        if (!courseId || !prompt) {
            return res.status(400).json({ success: false, message: 'Course ID and prompt are required' });
        }

        const course = await prisma.course.findUnique({
            where: { id: courseId },
            include: { sections: true }
        });

        if (!course || course.instructorId !== req.user.id && req.user.role !== 'ADMINISTRATOR') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const systemMessage = `You are an expert instructional designer. Generate a course curriculum outline based on the user's prompt. 
You must respond strictly in JSON format. Do not include markdown blocks or any other text.
The JSON must follow this exact schema:
{
  "sections": [
    {
      "title": "Section Title (e.g., Introduction)",
      "lessons": [
        {
          "title": "Lesson Title",
          "description": "Detailed markdown content or script for this lesson."
        }
      ]
    }
  ]
}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: `Create a comprehensive curriculum for a course about: ${prompt}` }
            ],
            model: 'llama3-8b-8192',
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const replyContent = chatCompletion.choices[0]?.message?.content;
        if (!replyContent) throw new Error('No content from Groq');

        const parsedData = JSON.parse(replyContent);
        
        if (!parsedData.sections || !Array.isArray(parsedData.sections)) {
            throw new Error('Invalid JSON structure returned by AI');
        }

        // Determine starting order for sections
        let currentSectionOrder = course.sections.length;

        // Save to Database
        for (const sec of parsedData.sections) {
            const createdSection = await prisma.section.create({
                data: {
                    courseId,
                    title: sec.title,
                    order: currentSectionOrder++
                }
            });

            if (sec.lessons && Array.isArray(sec.lessons)) {
                let currentLessonOrder = 0;
                for (const les of sec.lessons) {
                    await prisma.lesson.create({
                        data: {
                            sectionId: createdSection.id,
                            title: les.title,
                            content: les.description, // using description as initial content
                            type: 'ARTICLE', // Default to article for AI generated text
                            order: currentLessonOrder++
                        }
                    });
                }
            }
        }

        res.json({ success: true, message: 'Curriculum generated successfully' });
    } catch (error) {
        console.error('Groq AI Curriculum Error:', error);
        res.status(500).json({ success: false, message: error.message || 'AI request failed' });
    }
};
