import prisma from '../utils/prisma';
import { fileService } from './file.service';

export interface CreateMaterialData {
  courseId: string;
  fileId: string;
  title: string;
  description?: string;
  orderIndex: number;
}

export interface UpdateMaterialData {
  title?: string;
  description?: string;
  orderIndex?: number;
}

class MaterialService {
  async getMaterialsByCourse(courseId: string) {
    const materials = await prisma.courseMaterial.findMany({
      where: { courseId },
      include: {
        file: {
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    // Convert BigInt to number for JSON serialization
    return materials.map(material => ({
      ...material,
      file: {
        ...material.file,
        fileSize: Number(material.file.fileSize),
      },
    }));
  }

  async getMaterialById(id: string) {
    const material = await prisma.courseMaterial.findUnique({
      where: { id },
      include: {
        file: {
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        course: true,
      },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    return material;
  }

  async createMaterial(data: CreateMaterialData, organizationId: string) {
    // Verify course belongs to organization
    const course = await prisma.course.findFirst({
      where: {
        id: data.courseId,
        organizationId,
      },
    });

    if (!course) {
      throw new Error('Course not found or does not belong to your organization');
    }

    // Verify file exists and belongs to organization
    const file = await prisma.file.findFirst({
      where: {
        id: data.fileId,
        organizationId,
      },
    });

    if (!file) {
      throw new Error('File not found or does not belong to your organization');
    }

    const material = await prisma.courseMaterial.create({
      data: {
        courseId: data.courseId,
        fileId: data.fileId,
        title: data.title,
        description: data.description,
        orderIndex: data.orderIndex,
      },
      include: {
        file: {
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Convert BigInt to number for JSON serialization
    return {
      ...material,
      file: {
        ...material.file,
        fileSize: Number(material.file.fileSize),
      },
    };
  }

  async updateMaterial(id: string, data: UpdateMaterialData, organizationId: string) {
    // Verify material exists and belongs to organization
    const existingMaterial = await prisma.courseMaterial.findFirst({
      where: {
        id,
        course: {
          organizationId,
        },
      },
    });

    if (!existingMaterial) {
      throw new Error('Material not found or does not belong to your organization');
    }

    const material = await prisma.courseMaterial.update({
      where: { id },
      data,
      include: {
        file: {
          include: {
            uploader: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return material;
  }

  async deleteMaterial(id: string, organizationId: string) {
    // Verify material exists and belongs to organization
    const existingMaterial = await prisma.courseMaterial.findFirst({
      where: {
        id,
        course: {
          organizationId,
        },
      },
      include: {
        file: true,
      },
    });

    if (!existingMaterial) {
      throw new Error('Material not found or does not belong to your organization');
    }

    const fileId = existingMaterial.fileId;

    // Delete the material from database
    await prisma.courseMaterial.delete({
      where: { id },
    });

    // After deleting the material, try to delete the file
    // The file service will check if it's used elsewhere before deleting
    try {
      await fileService.deleteFile(fileId, organizationId);
    } catch (error) {
      // If file deletion fails (e.g., used elsewhere), that's okay
      // The material was still deleted successfully
      console.log('File not deleted (may be in use elsewhere):', error);
    }

    return { success: true };
  }

  async reorderMaterials(courseId: string, materialIds: string[], organizationId: string) {
    // Verify course belongs to organization
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        organizationId,
      },
    });

    if (!course) {
      throw new Error('Course not found or does not belong to your organization');
    }

    // Update order for each material
    await Promise.all(
      materialIds.map((materialId, index) =>
        prisma.courseMaterial.updateMany({
          where: {
            id: materialId,
            courseId,
          },
          data: {
            orderIndex: index,
          },
        })
      )
    );

    return { success: true };
  }
}

export const materialService = new MaterialService();
