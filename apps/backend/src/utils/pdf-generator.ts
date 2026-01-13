import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PdfGeneratorOptions {
  title: string;
  organizationName: string;
  dateRange?: { start: Date; end: Date };
  generatedAt: Date;
}

class PdfGenerator {
  /**
   * Format currency
   */
  private static formatCurrency(amount: number): string {
    return `${amount.toFixed(2)} PLN`;
  }

  /**
   * Format date
   */
  private static formatDate(date: Date | string | null): string {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy', { locale: pl });
  }

  /**
   * Encode text to handle Polish characters properly
   * Replaces Polish diacritics with base characters that render correctly in PDF
   */
  private static encodeText(text: string): string {
    const polishChars: { [key: string]: string } = {
      'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
      'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
      'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
      'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
    };

    return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polishChars[char] || char);
  }

  /**
   * Add header to PDF
   */
  private static addHeader(doc: PDFKit.PDFDocument, options: PdfGeneratorOptions): void {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(this.encodeText(options.organizationName), 50, 50);

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(this.encodeText(options.title), 50, 80);

    if (options.dateRange) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          this.encodeText(`Okres: ${this.formatDate(options.dateRange.start)} - ${this.formatDate(options.dateRange.end)}`),
          50,
          110
        );
    }

    doc
      .fontSize(8)
      .font('Helvetica')
      .text(this.encodeText(`Wygenerowano: ${this.formatDate(options.generatedAt)}`), 50, 130);

    doc.moveDown(2);
  }

  /**
   * Add table to PDF
   */
  private static addTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    columnWidths: number[]
  ): void {
    const startX = 50;
    let startY = doc.y + 10;
    const rowHeight = 25;

    // Draw headers
    doc.fontSize(9).font('Helvetica-Bold');
    let x = startX;
    headers.forEach((header, i) => {
      doc.text(this.encodeText(header), x, startY, {
        width: columnWidths[i],
        align: 'left',
      });
      x += columnWidths[i];
    });

    startY += rowHeight;

    // Draw separator line
    doc
      .moveTo(startX, startY - 5)
      .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY - 5)
      .stroke();

    // Draw rows
    doc.fontSize(8).font('Helvetica');
    rows.forEach((row, rowIndex) => {
      // Check if we need a new page
      if (startY > 700) {
        doc.addPage();
        startY = 50;

        // Redraw headers on new page
        doc.fontSize(9).font('Helvetica-Bold');
        x = startX;
        headers.forEach((header, i) => {
          doc.text(this.encodeText(header), x, startY, {
            width: columnWidths[i],
            align: 'left',
          });
          x += columnWidths[i];
        });
        startY += rowHeight;
        doc
          .moveTo(startX, startY - 5)
          .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), startY - 5)
          .stroke();
        doc.fontSize(8).font('Helvetica');
      }

      // Alternate row background color
      if (rowIndex % 2 === 1) {
        doc.rect(startX, startY - 5, columnWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#f9fafb');
      }

      x = startX;
      row.forEach((cell, i) => {
        doc.fillColor('#000000').text(this.encodeText(cell), x, startY, {
          width: columnWidths[i],
          align: i === 0 ? 'left' : 'right',
        });
        x += columnWidths[i];
      });

      startY += rowHeight;
    });

    doc.moveDown(2);
  }

  /**
   * Add summary section
   */
  private static addSummary(doc: PDFKit.PDFDocument, summaryItems: { label: string; value: string }[]): void {
    doc.fontSize(12).font('Helvetica-Bold').text(this.encodeText('Podsumowanie'), 50, doc.y + 20);

    doc.fontSize(10).font('Helvetica');
    summaryItems.forEach((item) => {
      doc.text(this.encodeText(`${item.label}: ${item.value}`), 50, doc.y + 10);
    });
  }

  /**
   * Generate Teacher Payouts PDF
   */
  static async generateTeacherPayoutsPdf(
    data: any[],
    organizationName: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Add header
        this.addHeader(doc, {
          title: 'Raport wypłat dla nauczycieli',
          organizationName,
          dateRange,
          generatedAt: new Date(),
        });

        // Add table
        const headers = ['Nauczyciel', 'Lekcji', 'Godziny', 'Wypłata', 'Status'];
        const columnWidths = [150, 60, 80, 100, 100];
        const rows = data.map((row) => [
          row.teacherName,
          String(row.lessonsCount),
          row.totalHours.toFixed(2),
          this.formatCurrency(row.totalPayout),
          row.payoutStatus || 'PENDING',
        ]);

        this.addTable(doc, headers, rows, columnWidths);

        // Add summary
        const totalLessons = data.reduce((sum, row) => sum + row.lessonsCount, 0);
        const totalHours = data.reduce((sum, row) => sum + row.totalHours, 0);
        const totalPayout = data.reduce((sum, row) => sum + row.totalPayout, 0);

        this.addSummary(doc, [
          { label: 'Liczba nauczycieli', value: String(data.length) },
          { label: 'Całkowita liczba lekcji', value: String(totalLessons) },
          { label: 'Całkowite godziny', value: totalHours.toFixed(2) },
          { label: 'Całkowita wypłata', value: this.formatCurrency(totalPayout) },
        ]);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate New Students PDF
   */
  static async generateNewStudentsPdf(
    data: any[],
    organizationName: string,
    month: number,
    year: number
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const monthNames = [
          'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
          'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
        ];

        this.addHeader(doc, {
          title: `Raport nowych uczniów - ${monthNames[month - 1]} ${year}`,
          organizationName,
          generatedAt: new Date(),
        });

        const headers = ['Imię i nazwisko', 'Email', 'Data zapisu', 'Poziom', 'Zapisy', 'Wydano'];
        const columnWidths = [120, 150, 80, 80, 60, 80];
        const rows = data.map((row) => [
          `${row.firstName} ${row.lastName}`,
          row.email,
          this.formatDate(row.enrollmentDate),
          row.languageLevel || '-',
          String(row.enrollmentsCount),
          this.formatCurrency(row.totalSpent),
        ]);

        this.addTable(doc, headers, rows, columnWidths);

        const totalSpent = data.reduce((sum, row) => sum + row.totalSpent, 0);

        this.addSummary(doc, [
          { label: 'Liczba nowych uczniów', value: String(data.length) },
          { label: 'Łączne wydatki uczniów', value: this.formatCurrency(totalSpent) },
        ]);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Margins PDF
   */
  static async generateMarginsPdf(
    data: any[],
    organizationName: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        this.addHeader(doc, {
          title: 'Raport marż',
          organizationName,
          dateRange,
          generatedAt: new Date(),
        });

        const headers = ['Typ kursu', 'Format', 'Przychód', 'Koszty', 'Zysk', 'Marża %'];
        const columnWidths = [150, 80, 90, 90, 90, 70];
        const rows = data.map((row) => [
          `${row.courseTypeName} (${row.language} ${row.level})`,
          row.format,
          this.formatCurrency(row.totalRevenue),
          this.formatCurrency(row.totalTeacherCost),
          this.formatCurrency(row.grossProfit),
          `${row.marginPercent.toFixed(2)}%`,
        ]);

        this.addTable(doc, headers, rows, columnWidths);

        const totalRevenue = data.reduce((sum, row) => sum + row.totalRevenue, 0);
        const totalCosts = data.reduce((sum, row) => sum + row.totalTeacherCost, 0);
        const totalProfit = totalRevenue - totalCosts;
        const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : '0.00';

        this.addSummary(doc, [
          { label: 'Całkowity przychód', value: this.formatCurrency(totalRevenue) },
          { label: 'Całkowite koszty', value: this.formatCurrency(totalCosts) },
          { label: 'Całkowity zysk', value: this.formatCurrency(totalProfit) },
          { label: 'Średnia marża', value: `${avgMargin}%` },
        ]);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Debtors PDF
   */
  static async generateDebtorsPdf(data: any[], organizationName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        this.addHeader(doc, {
          title: 'Raport dłużników',
          organizationName,
          generatedAt: new Date(),
        });

        const headers = ['Student', 'Email', 'Dług', 'Dni opóźn.', 'Płatności'];
        const columnWidths = [120, 150, 80, 80, 80];
        const rows = data.map((row) => [
          row.studentName,
          row.email,
          this.formatCurrency(row.totalDebt),
          String(row.daysOverdue),
          String(row.pendingPaymentsCount),
        ]);

        this.addTable(doc, headers, rows, columnWidths);

        const totalDebt = data.reduce((sum, row) => sum + row.totalDebt, 0);

        this.addSummary(doc, [
          { label: 'Liczba dłużników', value: String(data.length) },
          { label: 'Łączny dług', value: this.formatCurrency(totalDebt) },
        ]);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Retention PDF
   */
  static async generateRetentionPdf(data: any, organizationName: string, periodDays: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        this.addHeader(doc, {
          title: `Raport retencji i churn (okres: ${periodDays} dni)`,
          organizationName,
          generatedAt: new Date(),
        });

        // Summary first
        this.addSummary(doc, [
          { label: 'Łączna liczba uczniów', value: String(data.totalStudents) },
          { label: 'Aktywni uczniowie', value: String(data.activeStudents) },
          { label: 'Uczniowie zagrożeni', value: String(data.atRiskStudents) },
          { label: 'Uczniowie którzy odeszli', value: String(data.churnedStudents) },
          { label: 'Wskaźnik retencji', value: `${data.retentionRate}%` },
          { label: 'Wskaźnik churn', value: `${data.churnRate}%` },
        ]);

        doc.moveDown(2);

        // Active students
        if (data.activeStudentsList.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').text('Aktywni uczniowie', 50, doc.y + 10);
          doc.moveDown(0.5);

          const headers = ['Student', 'Ostatnia lekcja', 'Liczba lekcji'];
          const columnWidths = [180, 140, 100];
          const rows = data.activeStudentsList.slice(0, 20).map((student: any) => [
            student.studentName,
            this.formatDate(student.lastLessonDate),
            String(student.totalLessons),
          ]);

          this.addTable(doc, headers, rows, columnWidths);
        }

        // At risk students
        if (data.atRiskStudentsList.length > 0) {
          if (doc.y > 600) doc.addPage();
          doc.fontSize(12).font('Helvetica-Bold').text('Uczniowie zagrożeni', 50, doc.y + 10);
          doc.moveDown(0.5);

          const headers = ['Student', 'Ostatnia lekcja', 'Dni', 'Lekcje'];
          const columnWidths = [150, 120, 80, 70];
          const rows = data.atRiskStudentsList.slice(0, 20).map((student: any) => [
            student.studentName,
            this.formatDate(student.lastLessonDate),
            String(student.daysSinceLastLesson),
            String(student.totalLessons),
          ]);

          this.addTable(doc, headers, rows, columnWidths);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default PdfGenerator;
