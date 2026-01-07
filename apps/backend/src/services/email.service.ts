import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
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
      console.log('✉️  Email service enabled');
    }
  }

  /**
   * Send email using Resend
   */
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isEnabled) {
      console.log('📧 Email (disabled):', options.subject, 'to', options.to);
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: options.from || this.fromEmail,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('❌ Email send error:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Email sent:', options.subject, 'to', options.to, '- ID:', data?.id);
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('❌ Email send exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
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
        <p>Dzień dobry ${teacherName},</p>
        <p>Przypominamy o jutrzejszych zajęciach:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Uczeń:</strong> ${studentName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Czas trwania:</strong> ${lessonDuration} minut</p>
          <p style="margin: 5px 0;"><strong>Tryb:</strong> ${deliveryMode === 'ONLINE' ? 'Online' : 'Stacjonarnie'}</p>
          ${meetingUrl ? `<p style="margin: 5px 0;"><strong>Link:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>` : ''}
        </div>
        <p>Miłego dnia!</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">LingoDesk - System zarządzania szkołą językową</p>
      </div>
    `;

    // Email to student
    const studentHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2d4a65;">Przypomnienie o zajęciach</h2>
        <p>Dzień dobry ${studentName},</p>
        <p>Przypominamy o jutrzejszych zajęciach:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Lektor:</strong> ${teacherName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Czas trwania:</strong> ${lessonDuration} minut</p>
          <p style="margin: 5px 0;"><strong>Tryb:</strong> ${deliveryMode === 'ONLINE' ? 'Online' : 'Stacjonarnie'}</p>
          ${meetingUrl ? `<p style="margin: 5px 0;"><strong>Link:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>` : ''}
        </div>
        <p>Do zobaczenia!</p>
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
        <p>Dzień dobry ${studentName},</p>
        <p>Informujemy, że Twoje konto godzinowe jest na wyczerpaniu:</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Kurs:</strong> ${courseName}</p>
          <p style="margin: 5px 0;"><strong>Pozostało godzin:</strong> <span style="color: #dc2626; font-size: 24px; font-weight: bold;">${hoursRemaining.toFixed(1)}h</span></p>
        </div>
        <p>Prosimy o kontakt w celu doładowania konta, aby uniknąć przerwy w nauce.</p>
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
          <p>Informacja o niskim stanie konta ucznia:</p>
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Uczeń:</strong> ${studentName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${studentEmail}</p>
            <p style="margin: 5px 0;"><strong>Kurs:</strong> ${courseName}</p>
            <p style="margin: 5px 0;"><strong>Pozostało godzin:</strong> <span style="color: #dc2626; font-size: 24px; font-weight: bold;">${hoursRemaining.toFixed(1)}h</span></p>
          </div>
          <p>Prosimy o kontakt z uczniem w celu doładowania konta.</p>
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
        <p>Dzień dobry ${studentName},</p>
        <p>Lektor potwierdził Twoje zajęcia:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Lektor:</strong> ${teacherName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          <p style="margin: 5px 0;"><strong>Czas trwania:</strong> ${lessonDuration} minut</p>
        </div>
        <p>Do zobaczenia na zajęciach!</p>
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
        <p>Dzień dobry ${recipientName},</p>
        <p>Informujemy, że następujące zajęcia zostały odwołane:</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>${otherPersonRole === 'lektor' ? 'Lektor' : 'Uczeń'}:</strong> ${otherPersonName}</p>
          <p style="margin: 5px 0;"><strong>Temat:</strong> ${lessonTitle}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
          ${cancellationReason ? `<p style="margin: 5px 0;"><strong>Powód:</strong> ${cancellationReason}</p>` : ''}
        </div>
        <p>Prosimy o kontakt w celu ustalenia nowego terminu.</p>
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
        <p>Dzień dobry ${studentName},</p>
        <p>Gratulujemy! Zostałeś/aś pomyślnie zapisany/a na kurs:</p>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Nazwa kursu:</strong> ${courseName}</p>
          <p style="margin: 5px 0;"><strong>Typ:</strong> ${courseType}</p>
          <p style="margin: 5px 0;"><strong>Data rozpoczęcia:</strong> ${formattedDate}</p>
        </div>
        <p>Życzymy powodzenia w nauce!</p>
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
    invoiceUrl?: string;
  }) {
    const { studentEmail, studentName, amount, currency, paymentMethod, courseName, invoiceUrl } = data;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✓ Płatność potwierdzona</h2>
        <p>Dzień dobry ${studentName},</p>
        <p>Otrzymaliśmy Twoją płatność:</p>
        <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Kwota:</strong> <span style="font-size: 24px; color: #10b981;">${amount.toFixed(2)} ${currency}</span></p>
          <p style="margin: 5px 0;"><strong>Metoda płatności:</strong> ${paymentMethod}</p>
          ${courseName ? `<p style="margin: 5px 0;"><strong>Kurs:</strong> ${courseName}</p>` : ''}
        </div>
        ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Pobierz fakturę</a></p>` : ''}
        <p>Dziękujemy!</p>
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
        <p>Dzień dobry ${userName},</p>
        <p>Twoje konto zostało utworzone pomyślnie!</p>
        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Organizacja:</strong> ${organizationName}</p>
          <p style="margin: 5px 0;"><strong>Rola:</strong> ${roleNames[role] || role}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
        </div>
        <p>
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
}

export default new EmailService();
