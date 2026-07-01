const prisma = require('./src/config/database');
const bcrypt = require('bcryptjs');

async function seedQA() {
    try {
        console.log("Seeding QA Regression Data...");

        const plainPassword = "Password123!";
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(plainPassword, salt);

        // 1. Create QA Instructor
        const instructorEmail = "qa.instructor@teachures.com";
        const instructor = await prisma.user.upsert({
            where: { email: instructorEmail },
            update: { passwordHash, isVerified: true, role: 'INSTRUCTOR' },
            create: {
                email: instructorEmail,
                name: "QA Instructor",
                passwordHash,
                role: 'INSTRUCTOR',
                isVerified: true,
                instructorProfile: {
                    create: { bio: "QA automation account.", isApproved: true }
                }
            }
        });
        console.log(`- Instructor: ${instructor.email}`);

        // 2. Create QA Student
        const studentEmail = "qa.student@teachures.com";
        const student = await prisma.user.upsert({
            where: { email: studentEmail },
            update: { passwordHash, isVerified: true, role: 'STUDENT' },
            create: {
                email: studentEmail,
                name: "QA Student",
                passwordHash,
                role: 'STUDENT',
                isVerified: true
            }
        });
        console.log(`- Student: ${student.email}`);

        // 3. Create Regression Course
        const courseSlug = "qa-regression-course";
        
        // Delete existing course to ensure clean state if it exists
        const existingCourse = await prisma.course.findUnique({ where: { slug: courseSlug } });
        if (existingCourse) {
            console.log("- Cleaning up old QA course data...");
            await prisma.lessonProgress.deleteMany({ where: { lesson: { section: { courseId: existingCourse.id } } } });
            await prisma.question.deleteMany({ where: { courseId: existingCourse.id } });
            await prisma.quizAttempt.deleteMany({ where: { quiz: { lesson: { section: { courseId: existingCourse.id } } } } });
            await prisma.quiz.deleteMany({ where: { lesson: { section: { courseId: existingCourse.id } } } });
            await prisma.lesson.deleteMany({ where: { section: { courseId: existingCourse.id } } });
            await prisma.section.deleteMany({ where: { courseId: existingCourse.id } });
            await prisma.enrollment.deleteMany({ where: { courseId: existingCourse.id } });
            await prisma.courseProgress.deleteMany({ where: { courseId: existingCourse.id } });
            await prisma.certificate.deleteMany({ where: { courseId: existingCourse.id } });
            await prisma.course.delete({ where: { id: existingCourse.id } });
        }

        const course = await prisma.course.create({
            data: {
                title: "QA End-to-End Regression",
                slug: courseSlug,
                description: "A seeded course containing all elements needed to run full regression tests: video, quiz, and certificate generation.",
                instructorId: instructor.id,
                category: "Technology",
                level: "BEGINNER",
                isFree: true,
                isPublished: true,
                totalLessons: 2,
                sections: {
                    create: {
                        title: "Regression Section 1",
                        order: 1,
                        lessons: {
                            create: [
                                {
                                    title: "Regression Video Lesson",
                                    order: 1,
                                    type: "VIDEO",
                                    videoUrl: "sample_video.mp4",
                                    videoDuration: 120
                                },
                                {
                                    title: "Regression Final Quiz",
                                    order: 2,
                                    type: "QUIZ",
                                    quiz: {
                                        create: {
                                            title: "Regression Knowledge Check",
                                            passingScore: 100,
                                            maxAttempts: 99,
                                            questions: {
                                                create: [
                                                    {
                                                        text: "Is the QA regression test passing?",
                                                        type: "MCQ",
                                                        order: 1,
                                                        options: [
                                                            { id: "a", text: "Yes", isCorrect: true },
                                                            { id: "b", text: "No", isCorrect: false }
                                                        ]
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        });
        console.log(`- Course: ${course.title} (slug: ${course.slug})`);
        
        console.log("QA Seed completed successfully!");
    } catch (e) {
        console.error("QA Seed failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

seedQA();
