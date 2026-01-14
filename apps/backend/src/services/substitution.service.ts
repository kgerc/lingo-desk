import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateSubstitutionData {
  organizationId: string;
  lessonId: string;
  originalTeacherId: string;
  substituteTeacherId: string;
  reason?: string;
  notes?: string;
}

export interface UpdateSubstitutionData {
  substituteTeacherId?: string;
  reason?: string;
  notes?: string;
}

export interface GetSubstitutionsFilters {
  organizationId: string;
  originalTeacherId?: string;
  substituteTeacherId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

class SubstitutionService {
  /**
   * Create a new substitution
   */
  async createSubstitution(data: CreateSubstitutionData) {
    // Verify the lesson exists and belongs to the organization
    const lesson = await prisma.lesson.findFirst({
      where: {
        id: data.lessonId,
        organizationId: data.organizationId,
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    // Check if substitution already exists for this lesson
    const existingSubstitution = await prisma.substitution.findUnique({
      where: { lessonId: data.lessonId },
    });

    if (existingSubstitution) {
      throw new Error('Substitution already exists for this lesson');
    }

    // Verify both teachers exist and belong to the organization
    const [originalTeacher, substituteTeacher] = await Promise.all([
      prisma.teacher.findFirst({
        where: {
          id: data.originalTeacherId,
          organizationId: data.organizationId,
        },
      }),
      prisma.teacher.findFirst({
        where: {
          id: data.substituteTeacherId,
          organizationId: data.organizationId,
        },
      }),
    ]);

    if (!originalTeacher) {
      throw new Error('Original teacher not found');
    }

    if (!substituteTeacher) {
      throw new Error('Substitute teacher not found');
    }

    if (data.originalTeacherId === data.substituteTeacherId) {
      throw new Error('Original teacher and substitute teacher cannot be the same');
    }

    const substitution = await prisma.substitution.create({
      data: {
        organizationId: data.organizationId,
        lessonId: data.lessonId,
        originalTeacherId: data.originalTeacherId,
        substituteTeacherId: data.substituteTeacherId,
        reason: data.reason,
        notes: data.notes,
      },
      include: {
        lesson: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
            course: true,
          },
        },
        originalTeacher: {
          include: {
            user: true,
          },
        },
        substituteTeacher: {
          include: {
            user: true,
          },
        },
      },
    });

    return substitution;
  }

  /**
   * Get substitution by ID
   */
  async getSubstitutionById(id: string, organizationId: string) {
    const substitution = await prisma.substitution.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        lesson: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
            course: true,
          },
        },
        originalTeacher: {
          include: {
            user: true,
          },
        },
        substituteTeacher: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!substitution) {
      throw new Error('Substitution not found');
    }

    return substitution;
  }

  /**
   * Get substitution by lesson ID
   */
  async getSubstitutionByLessonId(lessonId: string, organizationId: string) {
    const substitution = await prisma.substitution.findFirst({
      where: {
        lessonId,
        organizationId,
      },
      include: {
        lesson: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
            course: true,
          },
        },
        originalTeacher: {
          include: {
            user: true,
          },
        },
        substituteTeacher: {
          include: {
            user: true,
          },
        },
      },
    });

    return substitution;
  }

  /**
   * Get substitutions with filters
   */
  async getSubstitutions(filters: GetSubstitutionsFilters) {
    const {
      organizationId,
      originalTeacherId,
      substituteTeacherId,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
    } = filters;

    const where: any = {
      organizationId,
    };

    if (originalTeacherId) {
      where.originalTeacherId = originalTeacherId;
    }

    if (substituteTeacherId) {
      where.substituteTeacherId = substituteTeacherId;
    }

    // Filter by lesson date range
    if (dateFrom || dateTo) {
      where.lesson = {
        scheduledAt: {},
      };
      if (dateFrom) {
        where.lesson.scheduledAt.gte = dateFrom;
      }
      if (dateTo) {
        where.lesson.scheduledAt.lte = dateTo;
      }
    }

    const substitutions = await prisma.substitution.findMany({
      where,
      include: {
        lesson: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
            course: true,
          },
        },
        originalTeacher: {
          include: {
            user: true,
          },
        },
        substituteTeacher: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return substitutions;
  }

  /**
   * Update substitution
   */
  async updateSubstitution(id: string, organizationId: string, data: UpdateSubstitutionData) {
    // Verify substitution exists
    const existingSubstitution = await prisma.substitution.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingSubstitution) {
      throw new Error('Substitution not found');
    }

    // If updating substitute teacher, verify they exist
    if (data.substituteTeacherId) {
      const substituteTeacher = await prisma.teacher.findFirst({
        where: {
          id: data.substituteTeacherId,
          organizationId,
        },
      });

      if (!substituteTeacher) {
        throw new Error('Substitute teacher not found');
      }

      if (existingSubstitution.originalTeacherId === data.substituteTeacherId) {
        throw new Error('Original teacher and substitute teacher cannot be the same');
      }
    }

    const substitution = await prisma.substitution.update({
      where: { id },
      data: {
        substituteTeacherId: data.substituteTeacherId,
        reason: data.reason,
        notes: data.notes,
      },
      include: {
        lesson: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
            course: true,
          },
        },
        originalTeacher: {
          include: {
            user: true,
          },
        },
        substituteTeacher: {
          include: {
            user: true,
          },
        },
      },
    });

    return substitution;
  }

  /**
   * Delete substitution
   */
  async deleteSubstitution(id: string, organizationId: string) {
    // Verify substitution exists
    const existingSubstitution = await prisma.substitution.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingSubstitution) {
      throw new Error('Substitution not found');
    }

    await prisma.substitution.delete({
      where: { id },
    });

    return { success: true };
  }
}

const substitutionService = new SubstitutionService();
export default substitutionService;
