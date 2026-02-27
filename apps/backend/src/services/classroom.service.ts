import prisma from '../utils/prisma';

class ClassroomService {
  /**
   * Get all classrooms for an organization (via location)
   */
  async getClassrooms(organizationId: string, options?: { locationId?: string; isActive?: boolean }) {
    const where: any = {
      location: { organizationId },
    };

    if (options?.locationId) {
      where.locationId = options.locationId;
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    return await prisma.classroom.findMany({
      where,
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
      orderBy: [{ location: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  /**
   * Get single classroom by ID
   */
  async getClassroomById(id: string, organizationId: string) {
    const classroom = await prisma.classroom.findFirst({
      where: { id, location: { organizationId } },
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
    });

    if (!classroom) {
      throw new Error('Classroom not found');
    }

    return classroom;
  }

  /**
   * Create a new classroom
   */
  async createClassroom(data: {
    locationId: string;
    name: string;
    capacity?: number;
    organizationId: string;
  }) {
    // Verify the location belongs to this organization
    const location = await prisma.location.findFirst({
      where: { id: data.locationId, organizationId: data.organizationId },
    });

    if (!location) {
      throw new Error('Location not found');
    }

    return await prisma.classroom.create({
      data: {
        locationId: data.locationId,
        name: data.name,
        capacity: data.capacity,
      },
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
    });
  }

  /**
   * Update a classroom
   */
  async updateClassroom(
    id: string,
    organizationId: string,
    data: { name?: string; capacity?: number; isActive?: boolean; locationId?: string }
  ) {
    const classroom = await prisma.classroom.findFirst({
      where: { id, location: { organizationId } },
    });

    if (!classroom) {
      throw new Error('Classroom not found');
    }

    if (data.locationId) {
      const location = await prisma.location.findFirst({
        where: { id: data.locationId, organizationId },
      });
      if (!location) {
        throw new Error('Location not found');
      }
    }

    return await prisma.classroom.update({
      where: { id },
      data,
      include: {
        location: { select: { id: true, name: true, address: true } },
      },
    });
  }

  /**
   * Delete a classroom (only if no future lessons)
   */
  async deleteClassroom(id: string, organizationId: string) {
    const classroom = await prisma.classroom.findFirst({
      where: { id, location: { organizationId } },
    });

    if (!classroom) {
      throw new Error('Classroom not found');
    }

    const futureLessons = await prisma.lesson.count({
      where: {
        classroomId: id,
        scheduledAt: { gte: new Date() },
        status: { notIn: ['CANCELLED'] },
      },
    });

    if (futureLessons > 0) {
      throw new Error(`Nie można usunąć sali — ma ${futureLessons} zaplanowanych lekcji`);
    }

    await prisma.classroom.delete({ where: { id } });
  }

  /**
   * Get all locations for an organization
   */
  async getLocations(organizationId: string, options?: { isActive?: boolean }) {
    const where: any = { organizationId };
    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    return await prisma.location.findMany({
      where,
      include: {
        classrooms: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a location
   */
  async createLocation(data: { organizationId: string; name: string; address?: string }) {
    return await prisma.location.create({ data });
  }

  /**
   * Update a location
   */
  async updateLocation(
    id: string,
    organizationId: string,
    data: { name?: string; address?: string; isActive?: boolean }
  ) {
    const location = await prisma.location.findFirst({ where: { id, organizationId } });
    if (!location) throw new Error('Location not found');

    return await prisma.location.update({ where: { id }, data });
  }

  /**
   * Delete a location (only if no classrooms and no future lessons)
   */
  async deleteLocation(id: string, organizationId: string) {
    const location = await prisma.location.findFirst({ where: { id, organizationId } });
    if (!location) throw new Error('Location not found');

    const classroomCount = await prisma.classroom.count({ where: { locationId: id } });
    if (classroomCount > 0) {
      throw new Error(`Nie można usunąć lokalizacji — ma ${classroomCount} sal`);
    }

    await prisma.location.delete({ where: { id } });
  }

  /**
   * Check if a classroom is available at a given time (no overlapping active lessons)
   */
  async checkConflict(
    classroomId: string,
    scheduledAt: Date,
    durationMinutes: number,
    excludeLessonId?: string
  ): Promise<{ hasConflict: boolean; conflictingLessons: any[] }> {
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

    const conflictingLessons = await prisma.lesson.findMany({
      where: {
        classroomId,
        status: { notIn: ['CANCELLED'] },
        ...(excludeLessonId ? { id: { not: excludeLessonId } } : {}),
        // Check for overlap: lesson starts before our end AND ends after our start
        scheduledAt: { lt: endTime },
        // computed end time > scheduledAt — approximate via raw query or subquery
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        durationMinutes: true,
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    // Filter in JS: lesson ends after our start
    const actualConflicts = conflictingLessons.filter((l) => {
      const lessonEnd = new Date(l.scheduledAt.getTime() + l.durationMinutes * 60 * 1000);
      return lessonEnd > scheduledAt;
    });

    return { hasConflict: actualConflicts.length > 0, conflictingLessons: actualConflicts };
  }
}

export const classroomService = new ClassroomService();
export default classroomService;
