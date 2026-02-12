import prisma from '../utils/prisma';
import emailService, { EmailAttachment } from './email.service';
import { PaymentStatus } from '@prisma/client';

export interface AttachmentData {
  filename: string;
  content: string; // base64 encoded
  contentType?: string;
}

export type MailType = 'custom' | 'welcome' | 'reminder' | 'payment' | 'teacher-rating' | 'survey' | 'complaint';

interface SendBulkEmailData {
  subject: string;
  message: string;
  mailType: MailType;
  recipients: 'all' | 'selected' | 'debtors' | 'course' | 'lesson';
  selectedStudentIds?: string[];
  courseId?: string;
  lessonId?: string;
  organizationId: string;
  attachments?: AttachmentData[];
  scheduledAt?: Date; // null = immediate
}

class MailingService {
  /**
   * Get recipients by course ID
   */
  private async getStudentsByCourse(courseId: string, organizationId: string) {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        courseId,
        status: 'ACTIVE',
        student: { organizationId },
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return enrollments.map(e => e.student);
  }

  /**
   * Get recipients by lesson ID (the student of that lesson)
   */
  private async getStudentsByLesson(lessonId: string, organizationId: string) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, organizationId },
      include: {
        student: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new Error('Lesson not found');
    }

    return [lesson.student];
  }

  /**
   * Build HTML email content with appropriate styling for each mail type
   */
  private buildEmailHtml(
    subject: string,
    message: string,
    mailType: MailType,
    context?: { courseName?: string; lessonTitle?: string; teacherName?: string },
    attachmentsInfoHtml?: string
  ): string {
    // Type-specific header colors and icons
    const typeConfig: Record<MailType, { color: string; label: string }> = {
      'custom': { color: '#2563eb', label: '' },
      'welcome': { color: '#2563eb', label: '' },
      'reminder': { color: '#d97706', label: '' },
      'payment': { color: '#dc2626', label: '' },
      'teacher-rating': { color: '#7c3aed', label: 'Ocena lektora' },
      'survey': { color: '#0891b2', label: 'Ankieta' },
      'complaint': { color: '#be185d', label: 'Reklamacja' },
    };

    const config = typeConfig[mailType] || typeConfig.custom;

    // Build context info section
    let contextHtml = '';
    if (context?.courseName || context?.lessonTitle || context?.teacherName) {
      const items: string[] = [];
      if (context.courseName) items.push(`<strong>Kurs:</strong> ${context.courseName}`);
      if (context.lessonTitle) items.push(`<strong>Lekcja:</strong> ${context.lessonTitle}`);
      if (context.teacherName) items.push(`<strong>Lektor:</strong> ${context.teacherName}`);

      contextHtml = `
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #6b7280;">${items.join(' &nbsp;|&nbsp; ')}</p>
        </div>
      `;
    }

    // Type badge
    const badgeHtml = config.label
      ? `<span style="display: inline-block; background-color: ${config.color}; color: white; font-size: 12px; padding: 2px 10px; border-radius: 12px; margin-bottom: 12px;">${config.label}</span><br/>`
      : '';

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${badgeHtml}
        <h2 style="color: ${config.color};">${subject}</h2>
        ${contextHtml}
        <div style="white-space: pre-wrap; line-height: 1.6;">
          ${message}
        </div>
        ${attachmentsInfoHtml || ''}
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 14px;">
          Ta wiadomość została wysłana z systemu zarządzania szkołą językową.
        </p>
      </div>
    `;
  }

  async sendBulkEmail(data: SendBulkEmailData) {
    const { subject, message, mailType, recipients, selectedStudentIds, courseId, lessonId, organizationId, attachments, scheduledAt } = data;

    // If scheduled for the future, save and return
    if (scheduledAt && scheduledAt > new Date()) {
      const scheduled = await prisma.notification.create({
        data: {
          organizationId,
          userId: (await prisma.user.findFirst({ where: { organizationId, role: 'ADMIN' }, select: { id: true } }))?.id || '',
          type: 'EMAIL',
          channel: 'EMAIL',
          subject,
          body: message,
          status: 'PENDING',
          sentAt: null,
          metadata: {
            mailType,
            recipients,
            selectedStudentIds,
            courseId,
            lessonId,
            scheduledAt: scheduledAt.toISOString(),
            attachments: attachments?.map(a => ({ filename: a.filename, contentType: a.contentType })),
          },
        },
      });

      return {
        totalSent: 0,
        totalFailed: 0,
        totalRecipients: 0,
        failedEmails: [],
        failedDetails: [],
        attachmentsIncluded: attachments ? attachments.length : 0,
        attachmentFailures: 0,
        scheduled: true,
        scheduledAt: scheduledAt.toISOString(),
        scheduledId: scheduled.id,
      };
    }

    // Convert attachments to EmailAttachment format
    const emailAttachments: EmailAttachment[] | undefined = attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType,
    }));

    // Get students based on recipients type
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
    } else if (recipients === 'course') {
      if (!courseId) {
        throw new Error('Course ID is required for course recipients');
      }
      students = await this.getStudentsByCourse(courseId, organizationId);
    } else if (recipients === 'lesson') {
      if (!lessonId) {
        throw new Error('Lesson ID is required for lesson recipients');
      }
      students = await this.getStudentsByLesson(lessonId, organizationId);
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

    // Fetch context info for course/lesson
    let context: { courseName?: string; lessonTitle?: string; teacherName?: string } = {};
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
      });
      if (course) {
        context.courseName = course.name;
        context.teacherName = `${course.teacher.user.firstName} ${course.teacher.user.lastName}`;
      }
    }
    if (lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: lessonId },
        include: {
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
          course: { select: { name: true } },
        },
      });
      if (lesson) {
        context.lessonTitle = lesson.title;
        context.teacherName = `${lesson.teacher.user.firstName} ${lesson.teacher.user.lastName}`;
        if (lesson.course) {
          context.courseName = lesson.course.name;
        }
      }
    }

    // Build attachments info for email body
    const attachmentsInfoHtml = emailAttachments && emailAttachments.length > 0
      ? `<p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
           📎 Załączniki: ${emailAttachments.map(a => a.filename).join(', ')}
         </p>`
      : '';

    // Build email HTML
    const html = this.buildEmailHtml(subject, message, mailType, context, attachmentsInfoHtml);

    // Send emails to all students
    const emailPromises = students.map((student) =>
      emailService.sendEmail({
        to: student.user.email,
        subject,
        html,
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
