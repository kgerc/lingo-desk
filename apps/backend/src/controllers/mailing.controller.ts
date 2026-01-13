import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import mailingService from '../services/mailing.service';
import prisma from '../utils/prisma';
import { PaymentStatus } from '@prisma/client';

const sendBulkEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  recipients: z.enum(['all', 'selected', 'debtors']),
  selectedStudentIds: z.array(z.string()).optional(),
});

export const sendBulkEmail = async (req: AuthRequest, res: Response) => {
  try {
    const validatedData = sendBulkEmailSchema.parse(req.body);
    const organizationId = req.user!.organizationId!;

    const result = await mailingService.sendBulkEmail({
      ...validatedData,
      organizationId,
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
