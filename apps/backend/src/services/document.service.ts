import { DocumentStatus, StudentDocumentType } from '@prisma/client';
import axios from 'axios';
import prisma from '../utils/prisma';
import { fileService } from './file.service';
import emailService from './email.service';

export interface UploadDocumentData {
  name: string;
  type?: StudentDocumentType;
  notes?: string;
  file: Buffer;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface CreateDocumentData {
  studentId: string;
  organizationId: string;
  name: string;
  type?: StudentDocumentType;
  notes?: string;
}

export interface UpdateDocumentData {
  status?: DocumentStatus;
  notes?: string;
  signedAt?: Date | null;
}

class DocumentService {
  async getStudentDocuments(studentId: string, organizationId: string) {
    // Verify student belongs to org
    const student = await prisma.student.findFirst({
      where: { id: studentId, organizationId },
    });
    if (!student) throw new Error('Student not found');

    return prisma.studentDocument.findMany({
      where: { studentId, organizationId },
      include: {
        file: {
          select: {
            id: true,
            publicUrl: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(
    studentId: string,
    organizationId: string,
    uploadedBy: string,
    data: UploadDocumentData
  ) {
    // Verify student belongs to org
    const student = await prisma.student.findFirst({
      where: { id: studentId, organizationId },
    });
    if (!student) throw new Error('Student not found');

    // Upload file via fileService
    const uploadedFile = await fileService.uploadFile(
      {
        file: data.file,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        relatedToType: 'STUDENT',
        relatedToId: studentId,
        isPublic: false,
      },
      organizationId,
      uploadedBy
    );

    // Create document record
    const document = await prisma.studentDocument.create({
      data: {
        organizationId,
        studentId,
        fileId: uploadedFile.id,
        name: data.name,
        type: data.type ?? StudentDocumentType.ATTACHMENT,
        notes: data.notes,
      },
      include: {
        file: {
          select: {
            id: true,
            publicUrl: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
          },
        },
      },
    });

    return document;
  }

  async createDocument(data: CreateDocumentData) {
    // Verify student belongs to org
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, organizationId: data.organizationId },
    });
    if (!student) throw new Error('Student not found');

    return prisma.studentDocument.create({
      data: {
        organizationId: data.organizationId,
        studentId: data.studentId,
        name: data.name,
        type: data.type ?? StudentDocumentType.CONTRACT,
        notes: data.notes,
      },
      include: {
        file: {
          select: {
            id: true,
            publicUrl: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
          },
        },
      },
    });
  }

  async updateDocument(id: string, organizationId: string, data: UpdateDocumentData) {
    const doc = await prisma.studentDocument.findFirst({
      where: { id, organizationId },
    });
    if (!doc) throw new Error('Document not found');

    return prisma.studentDocument.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.signedAt !== undefined && { signedAt: data.signedAt }),
      },
      include: {
        file: {
          select: {
            id: true,
            publicUrl: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
          },
        },
      },
    });
  }

  async deleteDocument(id: string, organizationId: string) {
    const doc = await prisma.studentDocument.findFirst({
      where: { id, organizationId },
      include: { file: true },
    });
    if (!doc) throw new Error('Document not found');

    // Delete StudentDocument record first
    await prisma.studentDocument.delete({ where: { id } });

    // If there's a linked file, delete it from storage + DB
    if (doc.fileId && doc.file) {
      try {
        // Bypass the courseMaterials check by deleting directly
        const { deleteFile: deleteFromStorage } = await import('../utils/supabase');
        await deleteFromStorage(doc.file.storagePath);
      } catch (err) {
        console.error('Error deleting file from storage:', err);
      }
      await prisma.file.delete({ where: { id: doc.fileId } }).catch(() => {
        // File may already be gone
      });
    }
  }

  async sendDocumentByEmail(id: string, organizationId: string, recipientEmail: string) {
    const doc = await prisma.studentDocument.findFirst({
      where: { id, organizationId },
      include: {
        file: true,
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!doc) throw new Error('Document not found');
    if (!doc.file) throw new Error('Document has no attached file');

    const studentName = `${doc.student.user.firstName} ${doc.student.user.lastName}`;

    // Fetch file content from Supabase public URL
    let fileBuffer: Buffer | undefined;
    try {
      const response = await axios.get<ArrayBuffer>(doc.file.publicUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      fileBuffer = Buffer.from(response.data);
    } catch (err) {
      console.error('Could not download file for email attachment:', err);
    }

    const result = await emailService.sendEmail({
      to: recipientEmail,
      subject: `Dokument: ${doc.name}`,
      html: `
        <p>Dzień dobry,</p>
        <p>W załączniku przesyłamy dokument <strong>${doc.name}</strong> dla ucznia <strong>${studentName}</strong>.</p>
        <p>Pozdrawiamy,<br/>Szkoła językowa</p>
      `,
      attachments: fileBuffer
        ? [
            {
              filename: doc.file.fileName,
              content: fileBuffer,
              contentType: doc.file.fileType,
            },
          ]
        : undefined,
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send email');
    }

    // Update sentAt and status
    return prisma.studentDocument.update({
      where: { id },
      data: {
        sentAt: new Date(),
        status: DocumentStatus.SENT,
      },
      include: {
        file: {
          select: {
            id: true,
            publicUrl: true,
            fileName: true,
            fileSize: true,
            fileType: true,
            storagePath: true,
          },
        },
      },
    });
  }
}

export const documentService = new DocumentService();
