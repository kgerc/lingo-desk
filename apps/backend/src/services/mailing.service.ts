import prisma from '../utils/prisma';
import emailService from './email.service';

interface SendBulkEmailData {
  subject: string;
  message: string;
  recipients: 'all' | 'selected';
  selectedStudentIds?: string[];
  organizationId: string;
}

class MailingService {
  async sendBulkEmail(data: SendBulkEmailData) {
    const { subject, message, recipients, selectedStudentIds, organizationId } = data;

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
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
            <p style="color: #6b7280; font-size: 14px;">
              Ta wiadomość została wysłana z systemu zarządzania szkołą językową.
            </p>
          </div>
        `,
      }).catch((error) => {
        console.error(`Failed to send email to ${student.user.email}:`, error);
        return { success: false, email: student.user.email };
      })
    );

    const results = await Promise.all(emailPromises);

    // Count successful and failed emails
    const failedEmails = results.filter((r: any) => r?.success === false);
    const successCount = students.length - failedEmails.length;

    return {
      totalSent: successCount,
      totalFailed: failedEmails.length,
      totalRecipients: students.length,
      failedEmails: failedEmails.map((r: any) => r.email),
    };
  }
}

export default new MailingService();
