import { format } from 'date-fns';

class CsvGenerator {
  /**
   * Escape CSV field
   */
  private static escapeField(field: any): string {
    if (field === null || field === undefined) {
      return '';
    }

    const str = String(field);

    // If field contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Format date to Polish format
   */
  private static formatDate(date: Date | string | null): string {
    if (!date) return '';
    return format(new Date(date), 'dd.MM.yyyy');
  }

  /**
   * Format number with decimals
   */
  private static formatNumber(num: number, decimals: number = 2): string {
    return num.toFixed(decimals);
  }

  /**
   * Generate CSV string from data array with UTF-8 BOM
   */
  static generateCsv(headers: string[], rows: string[][]): string {
    const headerRow = headers.map((h) => this.escapeField(h)).join(',');
    const dataRows = rows.map((row) => row.map((cell) => this.escapeField(cell)).join(','));

    // Add UTF-8 BOM (Byte Order Mark) for proper encoding in Excel
    const BOM = '\uFEFF';
    return BOM + [headerRow, ...dataRows].join('\n');
  }

  /**
   * Generate Teacher Payouts CSV
   */
  static generateTeacherPayoutsCsv(data: any[]): string {
    const headers = [
      'Nauczyciel',
      'Email',
      'Typ umowy',
      'Stawka godzinowa (PLN)',
      'Liczba lekcji',
      'Godziny',
      'Wypłata (PLN)',
      'Status',
    ];

    const rows = data.map((row) => [
      row.teacherName,
      row.email,
      row.contractType,
      this.formatNumber(row.hourlyRate),
      String(row.lessonsCount),
      this.formatNumber(row.totalHours),
      this.formatNumber(row.totalPayout),
      row.payoutStatus || 'PENDING',
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Generate New Students CSV
   */
  static generateNewStudentsCsv(data: any[]): string {
    const headers = [
      'Numer studenta',
      'Imię',
      'Nazwisko',
      'Email',
      'Telefon',
      'Data zapisu',
      'Poziom języka',
      'Cele',
      'Liczba zapisów',
      'Wydano (PLN)',
    ];

    const rows = data.map((row) => [
      row.studentNumber,
      row.firstName,
      row.lastName,
      row.email,
      row.phone || '',
      this.formatDate(row.enrollmentDate),
      row.languageLevel || '',
      row.goals || '',
      String(row.enrollmentsCount),
      this.formatNumber(row.totalSpent),
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Generate Margins CSV
   */
  static generateMarginsCsv(data: any[]): string {
    const headers = [
      'Kurs',
      'Typ',
      'Język',
      'Poziom',
      'Liczba płatności',
      'Przychód (PLN)',
      'Liczba lekcji',
      'Koszty nauczycieli (PLN)',
      'Zysk brutto (PLN)',
      'Marża (%)',
    ];

    const rows = data.map((row) => [
      row.courseName,
      row.courseType === 'GROUP' ? 'Grupowy' : 'Indywidualny',
      row.language,
      row.level,
      String(row.paymentsCount),
      this.formatNumber(row.totalRevenue),
      String(row.lessonsCount),
      this.formatNumber(row.totalTeacherCost),
      this.formatNumber(row.grossProfit),
      this.formatNumber(row.marginPercent),
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Generate Debtors CSV
   */
  static generateDebtorsCsv(data: any[]): string {
    const headers = [
      'Student',
      'Email',
      'Telefon',
      'Dług (PLN)',
      'Najstarsza płatność',
      'Dni opóźnienia',
      'Liczba płatności',
    ];

    const rows = data.map((row) => [
      row.studentName,
      row.email,
      row.phone || '',
      this.formatNumber(row.totalDebt),
      this.formatDate(row.oldestPaymentDate),
      String(row.daysOverdue),
      String(row.pendingPaymentsCount),
    ]);

    return this.generateCsv(headers, rows);
  }

  /**
   * Generate Retention CSV
   */
  static generateRetentionCsv(data: any): string {
    const headers = [
      'Kategoria',
      'Student',
      'Ostatnia lekcja',
      'Dni od ostatniej lekcji',
      'Liczba lekcji',
    ];

    const rows: string[][] = [];

    // Active students
    data.activeStudentsList.forEach((student: any) => {
      rows.push([
        'Aktywny',
        student.studentName,
        this.formatDate(student.lastLessonDate),
        '',
        String(student.totalLessons),
      ]);
    });

    // At risk students
    data.atRiskStudentsList.forEach((student: any) => {
      rows.push([
        'Zagrożony',
        student.studentName,
        this.formatDate(student.lastLessonDate),
        String(student.daysSinceLastLesson),
        String(student.totalLessons),
      ]);
    });

    // Churned students
    data.churnedStudentsList.forEach((student: any) => {
      rows.push([
        'Odszedł',
        student.studentName,
        this.formatDate(student.lastLessonDate),
        student.daysSinceLastLesson ? String(student.daysSinceLastLesson) : '',
        String(student.totalLessons),
      ]);
    });

    return this.generateCsv(headers, rows);
  }
}

export default CsvGenerator;
