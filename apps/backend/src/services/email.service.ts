import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Max attachment size: 10MB
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS_SIZE = 25 * 1024 * 1024;

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
}

class EmailService {
  private fromEmail: string;
  private isEnabled: boolean;

  constructor() {
    this.fromEmail = process.env.EMAIL_FROM || 'LingoDesk <noreply@lingodesk.com>';
    this.isEnabled = !!process.env.RESEND_API_KEY;

    if (!this.isEnabled) {
      console.warn('⚠️  Email service disabled - RESEND_API_KEY not configured');
    } else {
      console.log('✉️  Email service enabled with FROM:', this.fromEmail);
    }
  }

  /**
   * Validate attachments before sending
   */
  private validateAttachments(attachments?: EmailAttachment[]): { valid: boolean; error?: string } {
    if (!attachments || attachments.length === 0) {
      return { valid: true };
    }

    let totalSize = 0;

    for (const attachment of attachments) {
      const size = Buffer.isBuffer(attachment.content)
        ? attachment.content.length
        : Buffer.byteLength(attachment.content, 'base64');

      if (size > MAX_ATTACHMENT_SIZE) {
        return {
          valid: false,
          error: `Attachment "${attachment.filename}" exceeds max size of 10MB`
        };
      }

      totalSize += size;
    }

    if (totalSize > MAX_TOTAL_ATTACHMENTS_SIZE) {
      return {
        valid: false,
        error: `Total attachments size exceeds max of 25MB`
      };
    }

    return { valid: true };
  }

  /**
   * Send email using Resend
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string; attachmentsFailed?: boolean; email?: string }> {
    const recipientEmail = Array.isArray(options.to) ? options.to[0] : options.to;

    if (!this.isEnabled) {
      console.log('📧 Email (disabled):', options.subject, 'to', options.to);
      return { success: false, error: 'Email service not configured', email: recipientEmail };
    }

    // Validate attachments
    const attachmentValidation = this.validateAttachments(options.attachments);
    let attachmentsToSend = options.attachments;
    let attachmentsFailed = false;

    if (!attachmentValidation.valid) {
      console.warn('⚠️ Attachment validation failed:', attachmentValidation.error);
      // Fallback: send email without attachments
      attachmentsToSend = undefined;
      attachmentsFailed = true;
    }

    try {
      // Prepare attachments for Resend format
      const resendAttachments = attachmentsToSend?.map(att => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content, 'base64'),
      }));

      const { data, error } = await resend.emails.send({
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        attachments: resendAttachments,
      });

      if (error) {
        // If error is related to attachments, try sending without them (fallback)
        if (error.message?.toLowerCase().includes('attachment') && attachmentsToSend) {
          console.warn('⚠️ Attachment error, retrying without attachments:', error.message);

          const retryResult = await resend.emails.send({
            from: options.from || this.fromEmail,
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: options.subject,
            html: options.html,
          });

          if (retryResult.error) {
            console.error('❌ Email send error (retry):', retryResult.error);
            return { success: false, error: retryResult.error.message, email: recipientEmail };
          }

          console.log('✅ Email sent (without attachments):', options.subject, 'to', options.to, '- ID:', retryResult.data?.id);
          return { success: true, messageId: retryResult.data?.id, attachmentsFailed: true, email: recipientEmail };
        }

        console.error('❌ Email send error:', error, '| From:', options.from || this.fromEmail, '| To:', options.to);
        return { success: false, error: error.message, email: recipientEmail };
      }

      const attachmentCount = attachmentsToSend?.length || 0;
      console.log('✅ Email sent:', options.subject, 'to', options.to, '- ID:', data?.id, attachmentCount > 0 ? `(${attachmentCount} attachments)` : '');
      return { success: true, messageId: data?.id, attachmentsFailed, email: recipientEmail };
    } catch (error) {
      console.error('❌ Email send exception:', error, '| From:', options.from || this.fromEmail, '| To:', options.to);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        email: recipientEmail
      };
    }
  }

  /**
   * Send lesson reminder email (24h before)
   */
  async sendLessonReminder(data: {
    teacherEmail: string;
    teacherName: string;
    studentEmail: string;
    studentName: string;
    lessonTitle: string;
    lessonDate: Date;
    lessonDuration: number;
    deliveryMode: string;
    meetingUrl?: string;
  }) {
    const { teacherEmail, teacherName, studentEmail, studentName, lessonTitle, lessonDate, lessonDuration, deliveryMode, meetingUrl } = data;

    const formattedDate = new Date(lessonDate).toLocaleString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Email to teacher
    const teacherHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d4a65;">Przypomnienie o zajęciach</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${teacherName},</p>
        <p style="margin: 0 0 16px 0;">Przypominamy o jutrzejszych zajęciach:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Uczeń:</strong> ${studentName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Czas trwania:</strong> ${lessonDuration} minut</p>
          <p style="margin: 5px 0;"><strong>Tryb:</strong> ${deliveryMode === 'ONLINE' ? 'Online' : 'Stacjonarnie'}</p>
          ${meetingUrl ? `<p style="margin: 5px 0;"><strong>Link:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>` : ''}
        </div>
        <p style="margin: 0 0 16px 0;">Miłego dnia!</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    // Email to student
    const studentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d4a65;">Przypomnienie o zajęciach</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${studentName},</p>
        <p style="margin: 0 0 16px 0;">Przypominamy o jutrzejszych zajęciach:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Lektor:</strong> ${teacherName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Czas trwania:</strong> ${lessonDuration} minut</p>
          <p style="margin: 5px 0;"><strong>Tryb:</strong> ${deliveryMode === 'ONLINE' ? 'Online' : 'Stacjonarnie'}</p>
          ${meetingUrl ? `<p style="margin: 5px 0;"><strong>Link:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>` : ''}
        </div>
        <p style="margin: 0 0 16px 0;">Do zobaczenia!</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    // Send both emails
    const teacherResult = await this.sendEmail({
      to: teacherEmail,
      subject: `Przypomnienie: Zajęcia z ${studentName} jutro`,
      html: teacherHtml,
    });

    const studentResult = await this.sendEmail({
      to: studentEmail,
      subject: `Przypomnienie: Zajęcia z ${teacherName} jutro`,
      html: studentHtml,
    });

    return {
      teacher: teacherResult,
      student: studentResult,
    };
  }

  /**
   * Send low budget alert email
   */
  async sendLowBudgetAlert(data: {
    studentEmail: string;
    studentName: string;
    courseName: string;
    hoursRemaining: number;
    managerEmail?: string;
  }) {
    const { studentEmail, studentName, courseName, hoursRemaining, managerEmail } = data;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">⚠️ Alert: Niski stan konta</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${studentName},</p>
        <p style="margin: 0 0 16px 0;">Informujemy, że Twoje konto godzinowe jest na wyczerpaniu:</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Kurs:</strong> ${courseName}</p>
          <p style="margin: 5px 0;"><strong>Pozostało godzin:</strong> <span style="color: #dc2626; font-size: 24px; font-weight: bold;">${hoursRemaining.toFixed(1)}h</span></p>
        </div>
        <p style="margin: 0 0 16px 0;">Prosimy o kontakt w celu doładowania konta, aby uniknąć przerwy w nauce.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    // Send to student
    const studentResult = await this.sendEmail({
      to: studentEmail,
      subject: `⚠️ Niski stan konta - ${courseName}`,
      html,
    });

    // Also send to manager if provided
    let managerResult;
    if (managerEmail) {
      const managerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">⚠️ Alert: Uczeń z niskim budżetem</h2>
          <p style="margin: 0 0 16px 0;">Informacja o niskim stanie konta ucznia:</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Uczeń:</strong> ${studentName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${studentEmail}</p>
            <p style="margin: 5px 0;"><strong>Kurs:</strong> ${courseName}</p>
            <p style="margin: 5px 0;"><strong>Pozostało godzin:</strong> <span style="color: #dc2626; font-size: 24px; font-weight: bold;">${hoursRemaining.toFixed(1)}h</span></p>
          </div>
          <p style="margin: 0 0 16px 0;">Prosimy o kontakt z uczniem w celu doładowania konta.</p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
        </div>
      `;

      managerResult = await this.sendEmail({
        to: managerEmail,
        subject: `⚠️ Alert budżetowy: ${studentName} - ${courseName}`,
        html: managerHtml,
      });
    }

    return {
      student: studentResult,
      manager: managerResult,
    };
  }

  /**
   * Send lesson confirmation email
   */
  async sendLessonConfirmation(data: {
    studentEmail: string;
    studentName: string;
    teacherName: string;
    lessonTitle: string;
    lessonDate: Date;
    lessonDuration: number;
  }) {
    const { studentEmail, studentName, teacherName, lessonTitle, lessonDate, lessonDuration } = data;

    const formattedDate = new Date(lessonDate).toLocaleString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✓ Zajęcia potwierdzone</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${studentName},</p>
        <p style="margin: 0 0 16px 0;">Lektor potwierdził Twoje zajęcia:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Lektor:</strong> ${teacherName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Czas trwania:</strong> ${lessonDuration} minut</p>
        </div>
        <p style="margin: 0 0 16px 0;">Do zobaczenia na zajęciach!</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    return await this.sendEmail({
      to: studentEmail,
      subject: `✓ Potwierdzone: Zajęcia z ${teacherName}`,
      html,
    });
  }

  /**
   * Send lesson cancellation email
   */
  async sendLessonCancellation(data: {
    recipientEmail: string;
    recipientName: string;
    otherPersonName: string;
    otherPersonRole: 'lektor' | 'uczeń';
    lessonTitle: string;
    lessonDate: Date;
    cancellationReason?: string;
  }) {
    const { recipientEmail, recipientName, otherPersonName, otherPersonRole, lessonTitle, lessonDate, cancellationReason } = data;

    const formattedDate = new Date(lessonDate).toLocaleString('pl-PL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">❌ Zajęcia odwołane</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${recipientName},</p>
        <p style="margin: 0 0 16px 0;">Informujemy, że następujące zajęcia zostały odwołane:</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>${otherPersonRole === 'lektor' ? 'Lektor' : 'Uczeń'}:</strong> ${otherPersonName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          ${cancellationReason ? `<p style="margin: 5px 0;"><strong>Powód:</strong> ${cancellationReason}</p>` : ''}
        </div>
        <p style="margin: 0 0 16px 0;">Prosimy o kontakt w celu ustalenia nowego terminu.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `❌ Odwołane: Zajęcia z ${otherPersonName}`,
      html,
    });
  }

  /**
   * Send enrollment confirmation email
   */
  async sendEnrollmentConfirmation(data: {
    studentEmail: string;
    studentName: string;
    courseName: string;
    courseType: string;
    startDate: Date;
  }) {
    const { studentEmail, studentName, courseName, courseType, startDate } = data;

    const formattedDate = new Date(startDate).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">🎓 Witamy na kursie!</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${studentName},</p>
        <p style="margin: 0 0 16px 0;">Gratulujemy! Zostałeś/aś pomyślnie zapisany/a na kurs:</p>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Nazwa kursu:</strong> ${courseName}</p>
          <p style="margin: 5px 0;"><strong>Typ:</strong> ${courseType}</p>
          <p style="margin: 5px 0;"><strong>Data rozpoczęcia:</strong> ${formattedDate}</p>
        </div>
        <p style="margin: 0 0 16px 0;">Życzymy powodzenia w nauce!</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    return await this.sendEmail({
      to: studentEmail,
      subject: `🎓 Potwierdzenie zapisu: ${courseName}`,
      html,
    });
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(data: {
    studentEmail: string;
    studentName: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    courseName?: string;
    invoiceUrl?: string | null;
  }) {
    const { studentEmail, studentName, amount, currency, paymentMethod, courseName, invoiceUrl } = data;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✓ Płatność potwierdzona</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${studentName},</p>
        <p style="margin: 0 0 16px 0;">Otrzymaliśmy Twoją płatność:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Kwota:</strong> <span style="font-size: 24px; color: #10b981;">${amount.toFixed(2)} ${currency}</span></p>
          <p style="margin: 5px 0;"><strong>Metoda płatności:</strong> ${paymentMethod}</p>
          ${courseName ? `<p style="margin: 5px 0;"><strong>Kurs:</strong> ${courseName}</p>` : ''}
        </div>
        ${invoiceUrl ? `<p style="margin: 0 0 16px 0;"><a href="${invoiceUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Pobierz fakturę</a></p>` : ''}
        <p style="margin: 0 0 16px 0;">Dziękujemy!</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    return await this.sendEmail({
      to: studentEmail,
      subject: `✓ Potwierdzenie płatności: ${amount.toFixed(2)} ${currency}`,
      html,
    });
  }

  /**
   * Send lesson rescheduled email
   */
  async sendLessonRescheduled(data: {
    recipientEmail: string;
    recipientName: string;
    otherPersonName: string;
    otherPersonRole: 'lektor' | 'uczeń';
    lessonTitle: string;
    oldDate: Date;
    newDate: Date;
    lessonDuration: number;
    deliveryMode: string;
    meetingUrl?: string;
    rescheduledBy: string;
  }) {
    const {
      recipientEmail,
      recipientName,
      otherPersonName,
      otherPersonRole,
      lessonTitle,
      oldDate,
      newDate,
      lessonDuration,
      deliveryMode,
      meetingUrl,
      rescheduledBy,
    } = data;

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleString('pl-PL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const oldFormattedDate = formatDate(oldDate);
    const newFormattedDate = formatDate(newDate);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">🔄 Zmiana terminu zajęć</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${recipientName},</p>
        <p style="margin: 0 0 16px 0;">Informujemy o zmianie terminu zajęć przez ${rescheduledBy}:</p>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>${otherPersonRole === 'lektor' ? 'Lektor' : 'Uczeń'}:</strong> ${otherPersonName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Czas trwania:</strong> ${lessonDuration} minut</p>
          <p style="margin: 5px 0;"><strong>Tryb:</strong> ${deliveryMode === 'ONLINE' ? 'Online' : 'Stacjonarnie'}</p>
          ${meetingUrl ? `<p style="margin: 5px 0;"><strong>Link:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; margin: 20px 0; align-items: center;">
          <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #991b1b; font-size: 12px; font-weight: bold;">STARY TERMIN</p>
            <p style="margin: 10px 0 0 0; color: #dc2626;">${oldFormattedDate}</p>
          </div>
          <div style="font-size: 24px; color: #f59e0b;">→</div>
          <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #065f46; font-size: 12px; font-weight: bold;">NOWY TERMIN</p>
            <p style="margin: 10px 0 0 0; color: #059669; font-weight: bold;">${newFormattedDate}</p>
          </div>
        </div>

        <p style="margin: 0 0 16px 0;">Prosimy o potwierdzenie lub kontakt w razie pytań.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `🔄 Zmiana terminu: Zajęcia z ${otherPersonName}`,
      html,
    });
  }

  /**
   * Send payment reminder email
   */
  async sendPaymentReminder(data: {
    studentEmail: string;
    studentName: string;
    amount: number;
    currency: string;
    dueDate: Date | null;
    isOverdue: boolean;
    daysUntilDue?: number; // Positive = days until due, negative = days overdue
    organizationName: string;
    organizationEmail?: string;
    bankAccountInfo?: string;
    lessonInfo?: string;
  }) {
    const {
      studentEmail,
      studentName,
      amount,
      currency,
      dueDate,
      isOverdue,
      daysUntilDue,
      organizationName,
      organizationEmail,
      bankAccountInfo,
      lessonInfo,
    } = data;

    const formattedDueDate = dueDate
      ? new Date(dueDate).toLocaleDateString('pl-PL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Natychmiast';

    // Determine urgency level and styling
    let headerColor = '#f59e0b'; // Yellow for upcoming
    let headerEmoji = '⏰';
    let headerText = 'Przypomnienie o płatności';
    let urgencyMessage = '';

    if (isOverdue) {
      headerColor = '#ef4444'; // Red for overdue
      headerEmoji = '⚠️';
      headerText = 'Zaległa płatność';
      if (daysUntilDue !== undefined) {
        urgencyMessage = `Płatność jest przeterminowana o ${Math.abs(daysUntilDue)} dni.`;
      } else {
        urgencyMessage = 'Płatność jest przeterminowana.';
      }
    } else if (daysUntilDue !== undefined) {
      if (daysUntilDue === 0) {
        headerColor = '#f97316'; // Orange for due today
        headerEmoji = '📅';
        headerText = 'Płatność do dziś';
        urgencyMessage = 'Termin płatności upływa dzisiaj.';
      } else if (daysUntilDue <= 3) {
        urgencyMessage = `Pozostało ${daysUntilDue} dni do terminu płatności.`;
      } else {
        urgencyMessage = `Termin płatności: ${formattedDueDate}.`;
      }
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${headerColor};">${headerEmoji} ${headerText}</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${studentName},</p>
        <p style="margin: 0 0 16px 0;">${urgencyMessage || 'Przypominamy o oczekującej płatności:'}</p>
        <div style="background-color: ${isOverdue ? '#fef2f2' : '#fffbeb'}; border-left: 4px solid ${headerColor}; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Kwota do zapłaty:</strong> <span style="font-size: 24px; color: ${headerColor};">${amount.toFixed(2)} ${currency}</span></p>
          <p style="margin: 5px 0;"><strong>Termin płatności:</strong> ${formattedDueDate}</p>
          ${lessonInfo ? `<p style="margin: 5px 0;"><strong>Dotyczy:</strong> ${lessonInfo}</p>` : ''}
        </div>
        ${bankAccountInfo ? `
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-weight: bold; color: #374151;">Dane do przelewu:</p>
          <p style="margin: 10px 0 0 0; white-space: pre-line; color: #4b5563;">${bankAccountInfo}</p>
        </div>
        ` : ''}
        <p style="margin: 0 0 16px 0;">Prosimy o terminowe uregulowanie należności.</p>
        ${organizationEmail ? `<p style="margin: 0 0 16px 0;">W razie pytań prosimy o kontakt: <a href="mailto:${organizationEmail}">${organizationEmail}</a></p>` : ''}
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">${organizationName} - LingoDesk</p>
      </div>
    `;

    const subject = isOverdue
      ? `⚠️ Zaległa płatność: ${amount.toFixed(2)} ${currency}`
      : daysUntilDue === 0
        ? `📅 Płatność do dziś: ${amount.toFixed(2)} ${currency}`
        : `⏰ Przypomnienie o płatności: ${amount.toFixed(2)} ${currency}`;

    return await this.sendEmail({
      to: studentEmail,
      subject,
      html,
    });
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(data: {
    userEmail: string;
    userName: string;
    role: string;
    organizationName: string;
    loginUrl: string;
  }) {
    const { userEmail, userName, role, organizationName, loginUrl } = data;

    const roleNames: Record<string, string> = {
      ADMIN: 'Administrator',
      MANAGER: 'Manager',
      TEACHER: 'Lektor',
      STUDENT: 'Uczeń',
      PARENT: 'Rodzic',
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">👋 Witamy w LingoDesk!</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${userName},</p>
        <p style="margin: 0 0 16px 0;">Twoje konto zostało utworzone pomyślnie!</p>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Organizacja:</strong> ${organizationName}</p>
          <p style="margin: 5px 0;"><strong>Rola:</strong> ${roleNames[role] || role}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
        </div>
        <p style="margin: 0 0 16px 0;">
          <a href="${loginUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Zaloguj się
          </a>
        </p>
        <p style="margin-top: 20px;">Jeśli masz jakiekolwiek pytania, skontaktuj się z nami.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: `👋 Witamy w LingoDesk - ${organizationName}`,
      html,
    });
  }

  /**
   * Send user invitation email with temporary password
   */
  async sendUserInvitation(data: {
    to: string;
    firstName: string;
    organizationName: string;
    temporaryPassword: string;
    role: string;
  }) {
    const { to, firstName, organizationName, temporaryPassword, role } = data;

    const roleNames: Record<string, string> = {
      ADMIN: 'Administrator',
      MANAGER: 'Manager',
      HR: 'Kadrowy',
      METHODOLOGIST: 'Metodyk',
      TEACHER: 'Lektor',
      STUDENT: 'Uczeń',
      PARENT: 'Rodzic',
    };

    const loginUrl = process.env.FRONTEND_URL || 'https://lingodesk.pl';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">🎉 Zaproszenie do LingoDesk</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${firstName},</p>
        <p style="margin: 0 0 16px 0;">Zostałeś/aś zaproszony/a do organizacji <strong>${organizationName}</strong> w systemie LingoDesk.</p>

        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Rola:</strong> ${roleNames[role] || role}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
          <p style="margin: 5px 0;"><strong>Tymczasowe hasło:</strong></p>
          <p style="margin: 5px 0; font-family: monospace; background-color: #e0e7ff; padding: 10px; border-radius: 4px; font-size: 18px; letter-spacing: 1px;">${temporaryPassword}</p>
        </div>

        <p style="color: #dc2626; font-weight: bold;">⚠️ Ze względów bezpieczeństwa zmień hasło po pierwszym logowaniu!</p>

        <p style="margin: 0 0 16px 0;">
          <a href="${loginUrl}/login" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Zaloguj się
          </a>
        </p>

        <p style="margin-top: 20px;">Jeśli nie prosiłeś/aś o to konto, zignoruj tę wiadomość.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject: `🎉 Zaproszenie do ${organizationName} - LingoDesk`,
      html,
    });
  }

  /**
   * Send application received confirmation to the applicant
   */
  async sendApplicationConfirmation(data: {
    applicantEmail: string;
    applicantName: string;
    organizationName: string;
    courseName?: string;
  }) {
    const { applicantEmail, applicantName, organizationName, courseName } = data;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">✅ Zgłoszenie otrzymane</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${applicantName},</p>
        <p style="margin: 0 0 16px 0;">Dziękujemy za złożenie zgłoszenia! Twoja aplikacja została pomyślnie przyjęta przez szkołę <strong>${organizationName}</strong>.</p>
        ${courseName ? `
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Preferowany kurs:</strong> ${courseName}</p>
        </div>
        ` : ''}
        <p style="margin: 0 0 16px 0;">Nasz zespół zapozna się z Twoim zgłoszeniem i skontaktuje się z Tobą wkrótce.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">${organizationName} - LingoDesk</p>
      </div>
    `;

    return await this.sendEmail({
      to: applicantEmail,
      subject: `✅ Zgłoszenie otrzymane - ${organizationName}`,
      html,
    });
  }

  /**
   * Send application status change email (ACCEPTED or REJECTED)
   */
  async sendApplicationStatusChange(data: {
    applicantEmail: string;
    applicantName: string;
    organizationName: string;
    status: 'ACCEPTED' | 'REJECTED';
    courseName?: string;
    internalNotes?: string | null;
  }) {
    const { applicantEmail, applicantName, organizationName, status, courseName, internalNotes } = data;

    const isAccepted = status === 'ACCEPTED';
    const headerColor = isAccepted ? '#10b981' : '#ef4444';
    const headerEmoji = isAccepted ? '🎉' : '❌';
    const headerText = isAccepted ? 'Zgłoszenie zaakceptowane' : 'Zgłoszenie odrzucone';
    const bodyText = isAccepted
      ? 'Mamy przyjemność poinformować, że Twoje zgłoszenie zostało <strong>zaakceptowane</strong>. Wkrótce skontaktujemy się z Tobą w celu omówienia szczegółów.'
      : 'Przykro nam, ale Twoje zgłoszenie zostało <strong>odrzucone</strong>. Jeśli masz pytania, prosimy o kontakt z naszą szkołą.';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${headerColor};">${headerEmoji} ${headerText}</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${applicantName},</p>
        <p style="margin: 0 0 16px 0;">${bodyText}</p>
        ${courseName ? `
        <div style="background-color: ${isAccepted ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${headerColor}; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Kurs:</strong> ${courseName}</p>
          ${internalNotes ? `<p style="margin: 5px 0;"><strong>Informacja:</strong> ${internalNotes}</p>` : ''}
        </div>
        ` : (internalNotes ? `
        <div style="background-color: ${isAccepted ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${headerColor}; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Informacja:</strong> ${internalNotes}</p>
        </div>
        ` : '')}
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">${organizationName} - LingoDesk</p>
      </div>
    `;

    return await this.sendEmail({
      to: applicantEmail,
      subject: `${headerEmoji} ${headerText} - ${organizationName}`,
      html,
    });
  }

  /**
   * Send application converted to student (welcome + credentials)
   */
  async sendApplicationConverted(data: {
    studentEmail: string;
    studentName: string;
    organizationName: string;
    temporaryPassword: string;
    courseName?: string;
  }) {
    const { studentEmail, studentName, organizationName, temporaryPassword, courseName } = data;
    const loginUrl = process.env.FRONTEND_URL || 'https://lingodesk.pl';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">🎓 Twoje konto ucznia zostało utworzone!</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${studentName},</p>
        <p style="margin: 0 0 16px 0;">Twoje zgłoszenie zostało zaakceptowane i zostało dla Ciebie utworzone konto ucznia w <strong>${organizationName}</strong>.</p>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Email:</strong> ${studentEmail}</p>
          <p style="margin: 5px 0;"><strong>Tymczasowe hasło:</strong></p>
          <p style="margin: 5px 0; font-family: monospace; background-color: #e0e7ff; padding: 10px; border-radius: 4px; font-size: 18px; letter-spacing: 1px;">${temporaryPassword}</p>
          ${courseName ? `<p style="margin: 10px 0 0 0;"><strong>Zapisany kurs:</strong> ${courseName}</p>` : ''}
        </div>
        <p style="color: #dc2626; font-weight: bold;">⚠️ Ze względów bezpieczeństwa zmień hasło po pierwszym logowaniu!</p>
        <p style="margin: 0 0 16px 0;">
          <a href="${loginUrl}/login" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Zaloguj się
          </a>
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">${organizationName} - LingoDesk</p>
      </div>
    `;

    return await this.sendEmail({
      to: studentEmail,
      subject: `🎓 Konto ucznia gotowe - ${organizationName}`,
      html,
    });
  }

  /**
   * Send password reset email with new temporary password
   */
  async sendPasswordReset(data: {
    to: string;
    firstName: string;
    organizationName: string;
    temporaryPassword: string;
  }) {
    const { to, firstName, organizationName, temporaryPassword } = data;

    const loginUrl = process.env.FRONTEND_URL || 'https://lingodesk.pl';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">🔐 Reset hasła</h2>
        <p style="margin: 0 0 16px 0;">Dzień dobry ${firstName},</p>
        <p style="margin: 0 0 16px 0;">Twoje hasło zostało zresetowane przez administratora.</p>

        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Nowe tymczasowe hasło:</strong></p>
          <p style="margin: 5px 0; font-family: monospace; background-color: #fef3c7; padding: 10px; border-radius: 4px; font-size: 18px; letter-spacing: 1px;">${temporaryPassword}</p>
        </div>

        <p style="color: #dc2626; font-weight: bold;">⚠️ Ze względów bezpieczeństwa zmień hasło po zalogowaniu!</p>

        <p style="margin: 0 0 16px 0;">
          <a href="${loginUrl}/login" style="display: inline-block; background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">
            Zaloguj się
          </a>
        </p>

        <p style="margin-top: 20px;">Jeśli nie prosiłeś/aś o reset hasła, skontaktuj się z administratorem.</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">${organizationName} - LingoDesk</p>
      </div>
    `;

    return await this.sendEmail({
      to,
      subject: `🔐 Reset hasła - ${organizationName}`,
      html,
    });
  }
}

export default new EmailService();
