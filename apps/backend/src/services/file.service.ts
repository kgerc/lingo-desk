import prisma from '../utils/prisma';
import { uploadFile, deleteFile as deleteFileFromStorage } from '../utils/supabase';

export interface CreateFileData {
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  relatedToType?: string;
  relatedToId?: string;
  isPublic?: boolean;
}

export interface UploadFileData {
  file: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
  relatedToType?: string;
  relatedToId?: string;
  isPublic?: boolean;
}

class FileService {
  async getFilesByOrganization(organizationId: string, filters?: {
    relatedToType?: string;
    relatedToId?: string;
  }) {
    const files = await prisma.file.findMany({
      where: {
        organizationId,
        ...(filters?.relatedToType && { relatedToType: filters.relatedToType }),
        ...(filters?.relatedToId && { relatedToId: filters.relatedToId }),
      },
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
      orderBy: { createdAt: 'desc' },
    });

    return files;
  }

  async getFileById(id: string, organizationId: string) {
    const file = await prisma.file.findFirst({
      where: {
        id,
        organizationId,
      },
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
    });

    if (!file) {
      throw new Error('File not found');
    }

    return file;
  }

  async createFile(data: CreateFileData, organizationId: string, uploadedBy: string) {
    const file = await prisma.file.create({
      data: {
        organizationId,
        uploadedBy,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: BigInt(data.fileSize),
        storagePath: data.storagePath,
        publicUrl: data.publicUrl,
        relatedToType: data.relatedToType,
        relatedToId: data.relatedToId,
        isPublic: data.isPublic ?? false,
      },
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
    });

    return {
      ...file,
      fileSize: Number(file.fileSize),
    };
  }

  async uploadFile(data: UploadFileData, organizationId: string, uploadedBy: string) {
    try {
      // Upload to Supabase Storage
      const { path, publicUrl } = await uploadFile(
        data.file,
        data.fileName,
        organizationId,
        data.fileType
      );

      // Save file metadata to database
      const file = await prisma.file.create({
        data: {
          organizationId,
          uploadedBy,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: BigInt(data.fileSize),
          storagePath: path,
          publicUrl: publicUrl,
          relatedToType: data.relatedToType,
          relatedToId: data.relatedToId,
          isPublic: data.isPublic ?? false,
        },
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
      });

      return {
        ...file,
        fileSize: Number(file.fileSize),
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(id: string, organizationId: string) {
    // Verify file exists and belongs to organization
    const existingFile = await prisma.file.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existingFile) {
      throw new Error('File not found or does not belong to your organization');
    }

    // Check if file is used in course materials
    const materialsCount = await prisma.courseMaterial.count({
      where: { fileId: id },
    });

    if (materialsCount > 0) {
      throw new Error('Cannot delete file: it is being used in course materials');
    }

    // Delete from Supabase Storage
    try {
      await deleteFileFromStorage(existingFile.storagePath);
    } catch (error) {
      console.error('Error deleting from Supabase storage:', error);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await prisma.file.delete({
      where: { id },
    });

    return { success: true };
  }
}

export const fileService = new FileService();
