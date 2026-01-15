import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import mailingService, { AttachmentData } from '../services/mailing.service';
import prisma from '../utils/prisma';
import { PaymentStatus } from '@prisma/client';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Max total attachments: 25MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024;
// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/zip',
];

const sendBulkEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  recipients: z.enum(['all', 'selected', 'debtors']),
  selectedStudentIds: z.array(z.string()).optional(),
});

// Request type with multer files
interface MulterRequest extends AuthRequest {
  files?: Express.Multer.File[];
}

export const sendBulkEmail = async (req: MulterRequest, res: Response) => {
  try {
    // Parse form data - selectedStudentIds might come as JSON string
    let selectedStudentIds = req.body.selectedStudentIds;
    if (typeof selectedStudentIds === 'string') {
      try {
        selectedStudentIds = JSON.parse(selectedStudentIds);
      } catch {
        selectedStudentIds = undefined;
      }
    }

    const validatedData = sendBulkEmailSchema.parse({
      ...req.body,
      selectedStudentIds,
    });
    const organizationId = req.user!.organizationId!;

    // Process uploaded files
    const attachments: AttachmentData[] = [];
    let totalSize = 0;

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return res.status(400).json({
            message: `File type not allowed: ${file.originalname}. Allowed types: PDF, Word, Excel, PowerPoint, images, text files, CSV, ZIP.`
          });
        }

        // Validate individual file size
        if (file.size > MAX_FILE_SIZE) {
          return res.status(400).json({
            message: `File "${file.originalname}" exceeds max size of 10MB`
          });
        }

        totalSize += file.size;

        attachments.push({
          filename: file.originalname,
          content: file.buffer.toString('base64'),
          contentType: file.mimetype,
        });
      }

      // Validate total size
      if (totalSize > MAX_TOTAL_SIZE) {
        return res.status(400).json({
          message: 'Total attachments size exceeds max of 25MB'
        });
      }
    }

    const result = await mailingService.sendBulkEmail({
      subject: validatedData.subject,
      message: validatedData.message,
      recipients: validatedData.recipients,
      selectedStudentIds: validatedData.selectedStudentIds,
      organizationId,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error sending bulk email:', error);
    return res.status(500).json({ message: 'Failed to send bulk email' });
  }
};

export const getDebtorsCount = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user!.organizationId!;
    const now = new Date();

    const pendingPayments = await prisma.payment.findMany({
      where: {
        organizationId,
        status: PaymentStatus.PENDING,
        OR: [
          { dueAt: null },
          { dueAt: { lte: now } },
        ],
      },
      select: {
        studentId: true,
      },
      distinct: ['studentId'],
    });

    return res.status(200).json({ count: pendingPayments.length });
  } catch (error) {
    console.error('Error getting debtors count:', error);
    return res.status(500).json({ message: 'Failed to get debtors count' });
  }
};
