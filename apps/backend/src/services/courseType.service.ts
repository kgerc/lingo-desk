import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateCourseTypeData {
  organizationId: string;
  name: string;
  description?: string | null;
  language: string;
  level: string; // LanguageLevel enum value
  format: string; // CourseFormat enum value
  deliveryMode: string; // CourseDeliveryMode enum value
  defaultDurationMinutes: number;
  maxStudents?: number;
  pricePerLesson: number;
  currency?: string; // Default: PLN
}

class CourseTypeService {
  async getCourseTypes(organizationId: string) {
    const courseTypes = await prisma.courseType.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    return courseTypes;
  }

  async getCourseTypeById(id: string, organizationId: string) {
    const courseType = await prisma.courseType.findFirst({
      where: { id, organizationId },
    });

    if (!courseType) {
      throw new Error('Course type not found');
    }

    return courseType;
  }

  async createCourseType(data: CreateCourseTypeData) {
    const courseType = await prisma.courseType.create({
      data
    });
    return courseType;
  }

  async updateCourseType(id: string, organizationId: string, data: Partial<CreateCourseTypeData>) {
    const existingCourseType = await prisma.courseType.findFirst({
      where: { id, organizationId },
    });

    if (!existingCourseType) {
      throw new Error('Course type not found');
    }

    const courseType = await prisma.courseType.update({
      where: { id },
      data,
    });

    return courseType;
  }

  async deleteCourseType(id: string, organizationId: string) {
    const existingCourseType = await prisma.courseType.findFirst({
      where: { id, organizationId },
    });

    if (!existingCourseType) {
      throw new Error('Course type not found');
    }

    // Check if any courses are using this type
    const coursesCount = await prisma.course.count({
      where: { courseTypeId: id },
    });

    if (coursesCount > 0) {
      throw new Error(`Cannot delete course type with ${coursesCount} associated courses`);
    }

    await prisma.courseType.delete({
      where: { id },
    });

    return { message: 'Course type deleted successfully' };
  }
}

export default new CourseTypeService();
