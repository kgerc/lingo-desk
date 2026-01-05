import { PrismaClient, LanguageLevel, CourseFormat, CourseDeliveryMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting to seed course types...');

  // Get all organizations
  const organizations = await prisma.organization.findMany();

  if (organizations.length === 0) {
    console.log('No organizations found. Please create an organization first.');
    return;
  }

  // Default course types to create
  const defaultCourseTypes = [
    {
      name: 'Kurs grupowy - Angielski A1',
      description: 'Zajęcia w małych grupach do 10 osób',
      language: 'Angielski',
      level: LanguageLevel.A1,
      format: CourseFormat.GROUP,
      deliveryMode: CourseDeliveryMode.IN_PERSON,
      maxStudents: 10,
      pricePerLesson: 50,
    },
    {
      name: 'Kurs indywidualny - Angielski B1',
      description: 'Zajęcia jeden-na-jeden z lektorem',
      language: 'Angielski',
      level: LanguageLevel.B1,
      format: CourseFormat.INDIVIDUAL,
      deliveryMode: CourseDeliveryMode.BOTH,
      maxStudents: 1,
      pricePerLesson: 100,
    },
    {
      name: 'Kurs konwersacyjny - Angielski B2',
      description: 'Kurs skupiony na rozwijaniu umiejętności konwersacyjnych',
      language: 'Angielski',
      level: LanguageLevel.B2,
      format: CourseFormat.GROUP,
      deliveryMode: CourseDeliveryMode.ONLINE,
      maxStudents: 6,
      pricePerLesson: 60,
    },
    {
      name: 'Kurs biznesowy - Angielski C1',
      description: 'Język biznesowy i zawodowy',
      language: 'Angielski',
      level: LanguageLevel.C1,
      format: CourseFormat.INDIVIDUAL,
      deliveryMode: CourseDeliveryMode.BOTH,
      maxStudents: 1,
      pricePerLesson: 120,
    },
    {
      name: 'Przygotowanie do egzaminu - Angielski B2',
      description: 'Kurs przygotowujący do certyfikatów językowych',
      language: 'Angielski',
      level: LanguageLevel.B2,
      format: CourseFormat.GROUP,
      deliveryMode: CourseDeliveryMode.IN_PERSON,
      maxStudents: 8,
      pricePerLesson: 70,
    },
  ];

  // Create course types for each organization
  for (const org of organizations) {
    console.log(`Creating course types for organization: ${org.name}`);

    for (const courseType of defaultCourseTypes) {
      // Check if course type already exists
      const existing = await prisma.courseType.findFirst({
        where: {
          organizationId: org.id,
          name: courseType.name,
        },
      });

      if (!existing) {
        await prisma.courseType.create({
          data: {
            organizationId: org.id,
            ...courseType,
          },
        });
        console.log(`  ✓ Created: ${courseType.name}`);
      } else {
        console.log(`  - Already exists: ${courseType.name}`);
      }
    }
  }

  console.log('Finished seeding course types!');
}

main()
  .catch((e) => {
    console.error('Error seeding course types:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
