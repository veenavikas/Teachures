const Groq = require('groq-sdk');
const prisma = require('../../config/database');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY || 'dummy_key'
});

exports.askTutor = async (req, res) => {
    try {
        const { question, history = [], courseId, lessonId } = req.body;
        if (!question) {
            return res.status(400).json({ success: false, message: 'Question is required' });
        }

        let context = 'Your name is Bee. You are a helpful, friendly, and encouraging AI assistant for the Teachures website. You guide users around the website, answer questions, and help them with their learning and dashboard.';

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

        // Construct message array starting with system prompt, followed by history, then the new question
        const messages = [
            { role: 'system', content: context }
        ];

        // Append valid history messages
        if (Array.isArray(history)) {
            history.forEach(msg => {
                if (msg.role && msg.content) {
                    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
                }
            });
        }

        messages.push({ role: 'user', content: question });

        const chatCompletion = await groq.chat.completions.create({
            messages: messages,
            model: 'llama-3.1-8b-instant',
            temperature: 0.7,
            max_tokens: 1024
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
            model: 'llama-3.1-8b-instant',
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const replyContent = chatCompletion.choices[0]?.message?.content;
        if (!replyContent) throw new Error('No content from Groq');

        const parsedData = JSON.parse(replyContent);
        
        if (!parsedData.sections || !Array.isArray(parsedData.sections)) {
            throw new Error('Invalid JSON structure returned by AI');
        }

        // Return the structure to the frontend for preview instead of saving to DB immediately
        res.json({ success: true, message: 'Curriculum generated successfully', sections: parsedData.sections });
    } catch (error) {
        console.error('Groq AI Curriculum Error:', error);
        res.status(500).json({ success: false, message: error.message || 'AI request failed' });
    }
};

exports.generateQuiz = async (req, res) => {
    try {
        const { lessonId, content: providedContent } = req.body;
        
        let content = providedContent;

        if (lessonId) {
            const lesson = await prisma.lesson.findUnique({
                where: { id: lessonId },
                include: { section: { include: { course: true } } }
            });

            if (!lesson || (lesson.section.course.instructorId !== req.user.id && req.user.role !== 'ADMINISTRATOR')) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }
            content = lesson.content || lesson.title;
        }

        if (!content) {
            return res.status(400).json({ success: false, message: 'Lesson content is required to generate a quiz' });
        }

        const systemMessage = `You are an expert instructional designer. Generate a 5-question multiple-choice quiz based on the provided lesson content.
You must respond strictly in JSON format. Do not include markdown blocks or any other text.
The JSON must follow this exact schema:
{
  "questions": [
    {
      "text": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0,
      "explanation": "Brief explanation of why the answer is correct."
    }
  ]
}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: `Lesson Content:\n\n${content}` }
            ],
            model: 'llama-3.1-8b-instant',
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const replyContent = chatCompletion.choices[0]?.message?.content;
        if (!replyContent) throw new Error('No content from Groq');

        const parsedData = JSON.parse(replyContent);
        
        if (!parsedData.questions || !Array.isArray(parsedData.questions)) {
            throw new Error('Invalid JSON structure returned by AI');
        }

        res.json({ success: true, questions: parsedData.questions });
    } catch (error) {
        console.error('Groq AI Quiz Error:', error);
        res.status(500).json({ success: false, message: error.message || 'AI request failed' });
    }
};
