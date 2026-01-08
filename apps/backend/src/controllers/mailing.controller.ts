import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import mailingService from '../services/mailing.service';

const sendBulkEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  recipients: z.enum(['all', 'selected']),
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
