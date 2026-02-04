import { PrismaClient, PaymentStatus, PaymentReminderType } from '@prisma/client';
import emailService from './email.service';

const prisma = new PrismaClient();

interface SendReminderResult {
  success: boolean;
  reminderId?: string;
  error?: string;
}

class PaymentReminderService {
  /**
   * Send manual payment reminder
   */
  async sendManualReminder(
    paymentId: string,
    sentByUserId: string
  ): Promise<SendReminderResult> {
    // Get payment with student info
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        lesson: true,
        organization: true,
      },
    });

    if (!payment) {
      return { success: false, error: 'Nie znaleziono płatności' };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return { success: false, error: 'Płatność nie jest w statusie oczekującym' };
    }

    const studentEmail = payment.student.user.email;
    if (!studentEmail) {
      return { success: false, error: 'Uczeń nie ma przypisanego adresu email' };
    }

    // Check anti-spam: last reminder sent within minimum interval
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: payment.organizationId },
    });

    const minIntervalHours = settings?.paymentReminderMinIntervalHours ?? 24;

    const lastReminder = await prisma.paymentReminder.findFirst({
      where: {
        paymentId: payment.id,
        success: true,
      },
      orderBy: { sentAt: 'desc' },
    });

    if (lastReminder) {
      const hoursSinceLastReminder =
        (Date.now() - lastReminder.sentAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastReminder < minIntervalHours) {
        const hoursRemaining = Math.ceil(minIntervalHours - hoursSinceLastReminder);
        return {
          success: false,
          error: `Ostatnie przypomnienie zostało wysłane niedawno. Spróbuj ponownie za ${hoursRemaining} godz.`,
        };
      }
    }

    // Calculate days until/after due
    const now = new Date();
    let daysUntilDue: number | undefined;
    let isOverdue = false;

    if (payment.dueAt) {
      const diffMs = payment.dueAt.getTime() - now.getTime();
      daysUntilDue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      isOverdue = daysUntilDue < 0;
    } else {
      // No due date means immediately due (overdue)
      isOverdue = true;
    }

    // Build lesson info
    let lessonInfo: string | undefined;
    if (payment.lesson) {
      const lessonDate = new Date(payment.lesson.scheduledAt).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      lessonInfo = `Lekcja: ${payment.lesson.title} (${lessonDate})`;
    }

    // Send email
    const result = await emailService.sendPaymentReminder({
      studentEmail,
      studentName: `${payment.student.user.firstName} ${payment.student.user.lastName}`,
      amount: Number(payment.amount),
      currency: payment.currency,
      dueDate: payment.dueAt,
      isOverdue,
      daysUntilDue,
      organizationName: payment.organization.name,
      organizationEmail: payment.organization.email || undefined,
      lessonInfo,
    });

    // Log reminder
    const reminder = await prisma.paymentReminder.create({
      data: {
        organizationId: payment.organizationId,
        paymentId: payment.id,
        studentId: payment.studentId,
        type: PaymentReminderType.MANUAL,
        sentAt: new Date(),
        sentBy: sentByUserId,
        emailTo: studentEmail,
        subject: result.success
          ? `Przypomnienie o płatności: ${Number(payment.amount).toFixed(2)} ${payment.currency}`
          : 'Błąd wysyłki',
        success: result.success,
        errorMessage: result.error,
        metadata: {
          amount: Number(payment.amount),
          currency: payment.currency,
          dueAt: payment.dueAt?.toISOString() || null,
          isOverdue,
        },
      },
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Błąd wysyłki email' };
    }

    return { success: true, reminderId: reminder.id };
  }

  /**
   * Get payment reminder history
   */
  async getPaymentReminders(paymentId: string) {
    return prisma.paymentReminder.findMany({
      where: { paymentId },
      orderBy: { sentAt: 'desc' },
    });
  }

  /**
   * Get student's payment reminder history
   */
  async getStudentReminders(studentId: string, limit = 20) {
    return prisma.paymentReminder.findMany({
      where: { studentId },
      orderBy: { sentAt: 'desc' },
      take: limit,
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            dueAt: true,
          },
        },
      },
    });
  }

  /**
   * Process automatic payment reminders for an organization
   * This is called by the scheduler
   */
  async processAutomaticReminders(organizationId: string): Promise<{
    sent: number;
    failed: number;
    skipped: number;
  }> {
    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });

    if (!settings?.paymentReminderEnabled) {
      return { sent: 0, failed: 0, skipped: 0 };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all pending payments for the organization
    const pendingPayments = await prisma.payment.findMany({
      where: {
        organizationId,
        status: PaymentStatus.PENDING,
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        lesson: true,
        organization: true,
        reminders: {
          where: { success: true },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const minIntervalHours = settings.paymentReminderMinIntervalHours ?? 24;
    const daysBefore = settings.paymentReminderDaysBefore ?? [7, 3, 1];
    const daysAfter = settings.paymentReminderDaysAfter ?? [1, 3, 7];

    for (const payment of pendingPayments) {
      // Check if student has email
      const studentEmail = payment.student.user.email;
      if (!studentEmail) {
        skipped++;
        continue;
      }

      // Check anti-spam interval
      const lastReminder = payment.reminders[0];
      if (lastReminder) {
        const hoursSinceLastReminder =
          (Date.now() - lastReminder.sentAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastReminder < minIntervalHours) {
          skipped++;
          continue;
        }
      }

      // Calculate days until/after due
      let daysUntilDue: number | undefined;
      let isOverdue = false;
      let shouldSend = false;
      let reminderType: PaymentReminderType = PaymentReminderType.AUTO_BEFORE_DUE;

      if (payment.dueAt) {
        const dueDate = new Date(
          payment.dueAt.getFullYear(),
          payment.dueAt.getMonth(),
          payment.dueAt.getDate()
        );
        const diffDays = Math.floor(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );
        daysUntilDue = diffDays;
        isOverdue = diffDays < 0;

        if (diffDays === 0) {
          // Due today
          shouldSend = true;
          reminderType = PaymentReminderType.AUTO_ON_DUE;
        } else if (diffDays > 0 && daysBefore.includes(diffDays)) {
          // Before due date
          shouldSend = true;
          reminderType = PaymentReminderType.AUTO_BEFORE_DUE;
        } else if (diffDays < 0 && daysAfter.includes(Math.abs(diffDays))) {
          // After due date (overdue)
          shouldSend = true;
          reminderType = PaymentReminderType.AUTO_AFTER_DUE;
        }
      } else {
        // No due date - treat as overdue, send once per interval
        isOverdue = true;
        shouldSend = !lastReminder; // Only send if no previous reminder
        reminderType = PaymentReminderType.AUTO_AFTER_DUE;
      }

      if (!shouldSend) {
        skipped++;
        continue;
      }

      // Build lesson info
      let lessonInfo: string | undefined;
      if (payment.lesson) {
        const lessonDate = new Date(payment.lesson.scheduledAt).toLocaleDateString('pl-PL', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        lessonInfo = `Lekcja: ${payment.lesson.title} (${lessonDate})`;
      }

      // Send email
      const result = await emailService.sendPaymentReminder({
        studentEmail,
        studentName: `${payment.student.user.firstName} ${payment.student.user.lastName}`,
        amount: Number(payment.amount),
        currency: payment.currency,
        dueDate: payment.dueAt,
        isOverdue,
        daysUntilDue,
        organizationName: payment.organization.name,
        organizationEmail: payment.organization.email || undefined,
        lessonInfo,
      });

      // Log reminder
      await prisma.paymentReminder.create({
        data: {
          organizationId: payment.organizationId,
          paymentId: payment.id,
          studentId: payment.studentId,
          type: reminderType,
          sentAt: new Date(),
          sentBy: null, // Automatic
          emailTo: studentEmail,
          subject: isOverdue
            ? `Zaległa płatność: ${Number(payment.amount).toFixed(2)} ${payment.currency}`
            : `Przypomnienie o płatności: ${Number(payment.amount).toFixed(2)} ${payment.currency}`,
          success: result.success,
          errorMessage: result.error,
          metadata: {
            amount: Number(payment.amount),
            currency: payment.currency,
            dueAt: payment.dueAt?.toISOString() || null,
            isOverdue,
            daysUntilDue,
            reminderType,
          },
        },
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed, skipped };
  }

  /**
   * Process automatic reminders for all organizations
   */
  async processAllOrganizationsReminders(): Promise<{
    organizations: number;
    totalSent: number;
    totalFailed: number;
    totalSkipped: number;
  }> {
    const organizations = await prisma.organization.findMany({
      select: { id: true },
    });

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const org of organizations) {
      const result = await this.processAutomaticReminders(org.id);
      totalSent += result.sent;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
    }

    if (totalSent > 0 || totalFailed > 0) {
      console.log(
        `📧 Payment reminders processed: ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped`
      );
    }

    return {
      organizations: organizations.length,
      totalSent,
      totalFailed,
      totalSkipped,
    };
  }

  /**
   * Check if reminder can be sent for a payment (for UI)
   */
  async canSendReminder(paymentId: string): Promise<{
    canSend: boolean;
    reason?: string;
    lastReminderAt?: Date;
    nextAvailableAt?: Date;
  }> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: { user: true },
        },
        reminders: {
          where: { success: true },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!payment) {
      return { canSend: false, reason: 'Nie znaleziono płatności' };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return { canSend: false, reason: 'Płatność nie jest w statusie oczekującym' };
    }

    if (!payment.student.user.email) {
      return { canSend: false, reason: 'Uczeń nie ma przypisanego adresu email' };
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId: payment.organizationId },
    });

    const minIntervalHours = settings?.paymentReminderMinIntervalHours ?? 24;

    const lastReminder = payment.reminders[0];
    if (lastReminder) {
      const hoursSinceLastReminder =
        (Date.now() - lastReminder.sentAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastReminder < minIntervalHours) {
        const nextAvailableAt = new Date(
          lastReminder.sentAt.getTime() + minIntervalHours * 60 * 60 * 1000
        );
        return {
          canSend: false,
          reason: `Ostatnie przypomnienie wysłano ${new Date(lastReminder.sentAt).toLocaleString('pl-PL')}`,
          lastReminderAt: lastReminder.sentAt,
          nextAvailableAt,
        };
      }
    }

    return { canSend: true, lastReminderAt: lastReminder?.sentAt };
  }
}

export default new PaymentReminderService();
