const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function seedMockData() {
    try {
        console.log("Starting mock data creation...");
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password123', salt);

        // 1. Create Instructor
        const instructor = await prisma.user.upsert({
            where: { email: 'mock_instructor@example.com' },
            update: {
                name: 'Mock Instructor',
                passwordHash,
                role: 'INSTRUCTOR',
                isVerified: true
            },
            create: {
                email: 'mock_instructor@example.com',
                name: 'Mock Instructor',
                passwordHash,
                role: 'INSTRUCTOR',
                isVerified: true
            }
        });

        // Ensure Instructor Profile
        await prisma.instructorProfile.upsert({
            where: { userId: instructor.id },
            update: {
                isApproved: true,
                bio: 'A passionate mock instructor.'
            },
            create: {
                userId: instructor.id,
                isApproved: true,
                bio: 'A passionate mock instructor.'
            }
        });

        console.log("Mock Instructor created/updated:", instructor.email);

        // 2. Create Student
        const student = await prisma.user.upsert({
            where: { email: 'mock_student@example.com' },
            update: {
                name: 'Mock Student',
                passwordHash,
                role: 'STUDENT',
                isVerified: true
            },
            create: {
                email: 'mock_student@example.com',
                name: 'Mock Student',
                passwordHash,
                role: 'STUDENT',
                isVerified: true
            }
        });

        console.log("Mock Student created/updated:", student.email);

        // 3. Create Course
        const course = await prisma.course.upsert({
            where: { slug: 'mock-test-course' },
            update: {
                title: 'Mock Test Course',
                description: 'This is a mock course created for testing purposes.',
                category: 'Testing',
                level: 'BEGINNER',
                price: 0,
                isFree: true,
                isPublished: true,
                instructorId: instructor.id
            },
            create: {
                title: 'Mock Test Course',
                slug: 'mock-test-course',
                description: 'This is a mock course created for testing purposes.',
                category: 'Testing',
                level: 'BEGINNER',
                price: 0,
                isFree: true,
                isPublished: true,
                instructorId: instructor.id
            }
        });

        console.log("Mock Course created/updated:", course.title);

        // Check if sections already exist for this course
        const existingSections = await prisma.section.findMany({ where: { courseId: course.id } });
        if (existingSections.length === 0) {
            const section = await prisma.section.create({
                data: {
                    courseId: course.id,
                    title: 'Introduction to Testing',
                    order: 1,
                }
            });

            await prisma.lesson.create({
                data: {
                    sectionId: section.id,
                    title: 'Welcome to the Mock Course',
                    order: 1,
                    type: 'ARTICLE',
                    content: 'This is the first lesson of the mock course. Here you will learn nothing because it is just a test!',
                    isPreview: true
                }
            });

            console.log("Mock Section and Lesson created.");
        }

        console.log("Mock data seeding completed successfully.");
    } catch (error) {
        console.error("Error creating mock data:", error);
    } finally {
        await prisma.$disconnect();
    }
}

seedMockData();
