import prisma from '../utils/prisma';
import emailService, { EmailAttachment } from './email.service';
import { PaymentStatus } from '@prisma/client';

export interface AttachmentData {
  filename: string;
  content: string; // base64 encoded
  contentType?: string;
}

interface SendBulkEmailData {
  subject: string;
  message: string;
  recipients: 'all' | 'selected' | 'debtors';
  selectedStudentIds?: string[];
  organizationId: string;
  attachments?: AttachmentData[];
}

class MailingService {
  async sendBulkEmail(data: SendBulkEmailData) {
    const { subject, message, recipients, selectedStudentIds, organizationId, attachments } = data;

    // Convert attachments to EmailAttachment format
    const emailAttachments: EmailAttachment[] | undefined = attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));

    // Get students to send email to
    let students;
    if (recipients === 'all') {
      students = await prisma.student.findMany({
        where: { organizationId },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } else if (recipients === 'debtors') {
      // Get debtors - students with pending payments past due
      const now = new Date();
      const pendingPayments = await prisma.payment.findMany({
        where: {
          organizationId,
          status: PaymentStatus.PENDING,
          OR: [
            { dueAt: null },           // No due date set (immediate debtor)
            { dueAt: { lte: now } },   // Due date has passed
          ],
        },
        select: {
          studentId: true,
        },
        distinct: ['studentId'],
      });

      const debtorStudentIds = pendingPayments.map(p => p.studentId);

      if (debtorStudentIds.length === 0) {
        throw new Error('No debtors found');
      }

      students = await prisma.student.findMany({
        where: {
          id: { in: debtorStudentIds },
          organizationId,
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } else {
      if (!selectedStudentIds || selectedStudentIds.length === 0) {
        throw new Error('No students selected');
      }
      students = await prisma.student.findMany({
        where: {
          id: { in: selectedStudentIds },
          organizationId,
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    }

    if (students.length === 0) {
      throw new Error('No students found to send email to');
    }

    // Build attachments info for email body if attachments present
    const attachmentsInfoHtml = emailAttachments && emailAttachments.length > 0
      ? `<p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
           📎 Załączniki: ${emailAttachments.map(a => a.filename).join(', ')}
         </p>`
      : '';

    // Send emails to all students
    const emailPromises = students.map((student) =>
      emailService.sendEmail({
        to: student.user.email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">${subject}</h2>
            <div style="white-space: pre-wrap; line-height: 1.6;">
              ${message}
            </div>
            ${attachmentsInfoHtml}
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="color: #6b7280; font-size: 14px;">
              Ta wiadomość została wysłana z systemu zarządzania szkołą językową.
            </p>
          </div>
        `,
        attachments: emailAttachments,
      }).catch((error) => {
        console.error(`Failed to send email to ${student.user.email}:`, error);
        return { success: false, email: student.user.email, error: error?.message || 'Unknown error', attachmentsFailed: false };
      })
    );

    const results = await Promise.all(emailPromises);

    // Count successful, failed emails, and attachment failures
    const failedEmails = results.filter((r: any) => r?.success === false);
    const attachmentFailures = results.filter((r: any) => r?.attachmentsFailed === true);
    const successCount = students.length - failedEmails.length;

    // Log detailed failure info for debugging
    if (failedEmails.length > 0) {
      console.error('❌ Bulk email failures:', failedEmails.map((r: any) => ({
        email: r.email,
        error: r.error
      })));
    }

    return {
      totalSent: successCount,
      totalFailed: failedEmails.length,
      totalRecipients: students.length,
      failedEmails: failedEmails.map((r: any) => r.email),
      failedDetails: failedEmails.map((r: any) => ({ email: r.email, error: r.error })),
      attachmentsIncluded: emailAttachments ? emailAttachments.length : 0,
      attachmentFailures: attachmentFailures.length,
    };
  }
}

export default new MailingService();
