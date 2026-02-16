import { GoogleGenerativeAI } from '@google/generative-ai';
import { parse } from 'csv-parse/sync';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import balanceService from './balance.service';

// System fields that CSV columns can be mapped to
export const SYSTEM_FIELDS = [
  { key: 'date', label: 'Data płatności', required: true },
  { key: 'email', label: 'Email ucznia', required: true },
  { key: 'amount', label: 'Kwota', required: true },
  { key: 'paymentMethod', label: 'Metoda płatności', required: true },
  { key: 'status', label: 'Status', required: false },
  { key: 'notes', label: 'Notatki', required: false },
] as const;

export type SystemFieldKey = (typeof SYSTEM_FIELDS)[number]['key'];

export interface ColumnMapping {
  csvColumn: string;
  csvColumnIndex: number;
  systemField: SystemFieldKey | null;
  confidence: number; // 0-1
}

export interface CsvAnalysisResult {
  separator: string;
  headers: string[];
  rowCount: number;
  preview: string[][]; // first 10 rows of data (no header)
  mapping: ColumnMapping[];
  warnings: string[];
}

export interface ImportExecuteData {
  csvData: string;
  mapping: ColumnMapping[];
  separator: string;
  organizationId: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: string }>;
}

/**
 * Detect CSV separator by analyzing the first few lines
 */
function detectSeparator(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim()).slice(0, 5);
  const separators = [';', ',', '\t'];
  let bestSep = ',';
  let bestScore = 0;

  for (const sep of separators) {
    const counts = lines.map((line) => line.split(sep).length);
    const headerCount = counts[0];

    if (headerCount <= 1) continue;

    // Score based on: number of columns in header
    let score = headerCount;

    // Bonus for consistency across lines (if multiple lines exist)
    if (lines.length >= 2) {
      const consistentLines = counts.filter((c) => c === headerCount).length;
      score += (consistentLines / lines.length) * headerCount;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSep = sep;
    }
  }

  return bestSep;
}

/**
 * Parse CSV text into rows using csv-parse
 */
function parseCsv(text: string, separator: string): string[][] {
  try {
    const records: string[][] = parse(text, {
      delimiter: separator,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // handle BOM
    });
    return records;
  } catch {
    // Fallback to manual parsing
    return text
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => line.split(separator).map((c) => c.trim()));
  }
}

/**
 * Rule-based column mapping (fallback when AI is unavailable)
 */
function ruleBasedMapping(headers: string[]): ColumnMapping[] {
  const aliases: Record<SystemFieldKey, string[]> = {
    date: ['date', 'data', 'datum', 'dataplatnosci', 'datawplaty', 'paymentdate', 'termin'],
    email: ['email', 'e-mail', 'mail', 'studentemail', 'uczen', 'student', 'emailucznia'],
    amount: ['amount', 'kwota', 'suma', 'wartosc', 'wartość', 'cena', 'price', 'value', 'oplata', 'opłata'],
    paymentMethod: [
      'paymentmethod', 'metodaplatnosci', 'metoda', 'payment', 'platnosc',
      'płatność', 'typplatnosci', 'sposob', 'sposób', 'method',
    ],
    status: ['status', 'stan', 'state'],
    notes: ['notes', 'notatki', 'uwagi', 'note', 'notatka', 'komentarz', 'opis', 'description', 'comment'],
  };

  return headers.map((header, index) => {
    const normalized = header
      .toLowerCase()
      .replace(/[^a-z0-9ąćęłńóśźżü]/g, '');

    let bestMatch: SystemFieldKey | null = null;
    let bestConfidence = 0;

    for (const [field, fieldAliases] of Object.entries(aliases) as [SystemFieldKey, string[]][]) {
      for (const alias of fieldAliases) {
        const normalizedAlias = alias.replace(/[^a-z0-9ąćęłńóśźżü]/g, '');
        if (normalized === normalizedAlias) {
          bestMatch = field;
          bestConfidence = 0.9;
          break;
        }
        if (normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) {
          if (bestConfidence < 0.6) {
            bestMatch = field;
            bestConfidence = 0.6;
          }
        }
      }
      if (bestConfidence >= 0.9) break;
    }

    return {
      csvColumn: header,
      csvColumnIndex: index,
      systemField: bestMatch,
      confidence: bestConfidence,
    };
  });
}

/**
 * AI-based column mapping using Gemini
 */
async function aiBasedMapping(
  headers: string[],
  sampleRows: string[][]
): Promise<ColumnMapping[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    return ruleBasedMapping(headers);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const sampleData = sampleRows
      .slice(0, 3)
      .map((row) => row.join(' | '))
      .join('\n');

    const prompt = `You are a CSV column mapping assistant for a language school payment import system.

Given these CSV headers and sample data, map each column to the correct system field.

CSV Headers: ${JSON.stringify(headers)}

Sample data (first 3 rows):
${sampleData}

System fields to map to:
- "date" - payment date (any date format)
- "email" - student email address
- "amount" - payment amount (numeric)
- "paymentMethod" - payment method (cash, transfer, card, etc.)
- "status" - payment status (completed, pending, etc.)
- "notes" - notes/comments

Respond ONLY with a JSON array. Each element must have:
- "csvColumnIndex": number (0-based index)
- "systemField": string or null (one of: "date", "email", "amount", "paymentMethod", "status", "notes", or null if no match)
- "confidence": number between 0 and 1

Rules:
- Each system field can be mapped to at most ONE csv column
- Columns that don't match any system field should have systemField: null
- Be generous with matching - column names may be in Polish, English, German or other languages
- Consider the sample data values to determine the field type (e.g., "@" suggests email, numbers suggest amount)

JSON response:`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return ruleBasedMapping(headers);
    }

    const aiMapping: Array<{
      csvColumnIndex: number;
      systemField: SystemFieldKey | null;
      confidence: number;
    }> = JSON.parse(jsonMatch[0]);

    // Validate and build mapping
    const validFields = SYSTEM_FIELDS.map((f) => f.key);

    return headers.map((header, index) => {
      const aiResult = aiMapping.find((m) => m.csvColumnIndex === index);

      if (aiResult && aiResult.systemField && validFields.includes(aiResult.systemField)) {
        return {
          csvColumn: header,
          csvColumnIndex: index,
          systemField: aiResult.systemField,
          confidence: Math.min(1, Math.max(0, aiResult.confidence)),
        };
      }

      return {
        csvColumn: header,
        csvColumnIndex: index,
        systemField: null,
        confidence: 0,
      };
    });
  } catch (error) {
    console.error('AI mapping failed, falling back to rules:', error);
    return ruleBasedMapping(headers);
  }
}

/**
 * Deduplicate mapping - ensure each system field is mapped to at most one column
 * Keep the highest confidence mapping for each field
 */
function deduplicateMapping(mapping: ColumnMapping[]): ColumnMapping[] {
  const fieldBestIndex = new Map<string, number>();

  // Find best index for each field
  for (let i = 0; i < mapping.length; i++) {
    const m = mapping[i];
    if (!m.systemField) continue;

    const existing = fieldBestIndex.get(m.systemField);
    if (existing === undefined || m.confidence > mapping[existing].confidence) {
      fieldBestIndex.set(m.systemField, i);
    }
  }

  // Clear duplicates
  return mapping.map((m, i) => {
    if (!m.systemField) return m;
    if (fieldBestIndex.get(m.systemField) !== i) {
      return { ...m, systemField: null, confidence: 0 };
    }
    return m;
  });
}

class CsvImportService {
  /**
   * Analyze CSV file and propose column mapping
   */
  async analyzeCsv(csvData: string): Promise<CsvAnalysisResult> {
    const warnings: string[] = [];

    // Detect separator
    const separator = detectSeparator(csvData);

    // Parse CSV
    const allRows = parseCsv(csvData, separator);

    if (allRows.length < 2) {
      throw new Error('Plik CSV jest pusty lub zawiera tylko nagłówek');
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1);
    const preview = dataRows.slice(0, 10);

    // Get AI-based mapping (falls back to rules if AI unavailable)
    let mapping = await aiBasedMapping(headers, preview);
    mapping = deduplicateMapping(mapping);

    // Check for required fields
    const mappedFields = mapping.filter((m) => m.systemField).map((m) => m.systemField);
    for (const field of SYSTEM_FIELDS) {
      if (field.required && !mappedFields.includes(field.key)) {
        warnings.push(`Nie znaleziono mapowania dla wymaganego pola: ${field.label}`);
      }
    }

    // Check for low confidence mappings
    for (const m of mapping) {
      if (m.systemField && m.confidence < 0.7) {
        const fieldLabel = SYSTEM_FIELDS.find((f) => f.key === m.systemField)?.label || m.systemField;
        warnings.push(`Niska pewność mapowania kolumny "${m.csvColumn}" → ${fieldLabel}`);
      }
    }

    return {
      separator,
      headers,
      rowCount: dataRows.length,
      preview,
      mapping,
      warnings,
    };
  }

  /**
   * Execute import with confirmed mapping
   */
  async executeImport(data: ImportExecuteData): Promise<ImportResult> {
    const { csvData, mapping, separator, organizationId } = data;

    const allRows = parseCsv(csvData, separator);
    const dataRows = allRows.slice(1); // skip header

    const results: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Build field index map
    const fieldIndex: Partial<Record<SystemFieldKey, number>> = {};
    for (const m of mapping) {
      if (m.systemField) {
        fieldIndex[m.systemField] = m.csvColumnIndex;
      }
    }

    // Validate required fields are mapped
    const requiredFields: SystemFieldKey[] = ['date', 'email', 'amount', 'paymentMethod'];
    for (const field of requiredFields) {
      if (fieldIndex[field] === undefined) {
        const label = SYSTEM_FIELDS.find((f) => f.key === field)?.label || field;
        results.failed++;
        results.errors.push({
          row: 0,
          error: `Brak mapowania dla wymaganego pola: ${label}`,
          data: '',
        });
        return results;
      }
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 1-indexed, skip header
      const rowText = row.join(separator);

      try {
        const getValue = (field: SystemFieldKey): string => {
          const idx = fieldIndex[field];
          return idx !== undefined && idx < row.length ? row[idx].trim() : '';
        };

        // Parse date
        const dateStr = getValue('date');
        const paidAt = this.parseDate(dateStr);
        if (!paidAt) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            error: `Nieprawidłowy format daty: "${dateStr}"`,
            data: rowText,
          });
          continue;
        }

        // Find student
        const studentEmail = getValue('email').toLowerCase();
        if (!studentEmail) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            error: 'Brak adresu email ucznia',
            data: rowText,
          });
          continue;
        }

        const student = await prisma.student.findFirst({
          where: {
            organizationId,
            user: { email: studentEmail },
          },
        });

        if (!student) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            error: `Nie znaleziono ucznia z emailem: ${studentEmail}`,
            data: rowText,
          });
          continue;
        }

        // Parse amount
        const amountStr = getValue('amount');
        const amount = parseFloat(amountStr.replace(',', '.').replace(/[^\d.-]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            error: `Nieprawidłowa kwota: "${amountStr}"`,
            data: rowText,
          });
          continue;
        }

        // Parse payment method
        const methodStr = getValue('paymentMethod');
        const paymentMethod = this.parsePaymentMethod(methodStr);
        if (!paymentMethod) {
          results.failed++;
          results.errors.push({
            row: rowNum,
            error: `Nieprawidłowa metoda płatności: "${methodStr}"`,
            data: rowText,
          });
          continue;
        }

        // Parse status (optional, defaults to COMPLETED)
        const statusStr = getValue('status');
        const status = statusStr ? this.parseStatus(statusStr) : PaymentStatus.COMPLETED;

        // Notes (optional)
        const notes = getValue('notes') || null;

        // Get organization currency
        const org = await prisma.organization.findUnique({
          where: { id: organizationId },
          select: { currency: true },
        });
        const currency = org?.currency || 'PLN';

        // Create payment
        const payment = await prisma.payment.create({
          data: {
            organizationId,
            studentId: student.id,
            amount,
            currency,
            status,
            paymentMethod,
            paidAt,
            notes,
          },
        });

        // Add deposit to student balance if completed
        if (status === PaymentStatus.COMPLETED) {
          await balanceService.addDeposit(
            student.id,
            organizationId,
            amount,
            payment.id,
            `Import CSV - wpłata z dnia ${dateStr}`
          );
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: rowNum,
          error: error.message || 'Nieznany błąd',
          data: rowText,
        });
      }
    }

    return results;
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;

    const cleaned = dateStr.trim();

    // Try DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (dmyMatch) {
      const d = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }

    // Try YYYY-MM-DD
    const ymdMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) return d;
    }

    // Try DD-MM-YYYY
    const dmyDash = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyDash) {
      const d = new Date(`${dmyDash[3]}-${dmyDash[2].padStart(2, '0')}-${dmyDash[1].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }

    // Generic fallback
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) return d;

    return null;
  }

  private parsePaymentMethod(str: string): PaymentMethod | null {
    const map: Record<string, PaymentMethod> = {
      STRIPE: PaymentMethod.STRIPE,
      CASH: PaymentMethod.CASH,
      'GOTÓWKA': PaymentMethod.CASH,
      GOTOWKA: PaymentMethod.CASH,
      BANK_TRANSFER: PaymentMethod.BANK_TRANSFER,
      PRZELEW: PaymentMethod.BANK_TRANSFER,
      TRANSFER: PaymentMethod.BANK_TRANSFER,
      KARTA: PaymentMethod.CASH, // fallback
    };

    return map[str.toUpperCase().trim()] || null;
  }

  private parseStatus(str: string): PaymentStatus {
    const map: Record<string, PaymentStatus> = {
      PENDING: PaymentStatus.PENDING,
      'OCZEKUJĄCE': PaymentStatus.PENDING,
      OCZEKUJACE: PaymentStatus.PENDING,
      COMPLETED: PaymentStatus.COMPLETED,
      'ZAKOŃCZONE': PaymentStatus.COMPLETED,
      ZAKONCZONE: PaymentStatus.COMPLETED,
      'OPŁACONE': PaymentStatus.COMPLETED,
      OPLACONE: PaymentStatus.COMPLETED,
      FAILED: PaymentStatus.FAILED,
      NIEUDANE: PaymentStatus.FAILED,
      REFUNDED: PaymentStatus.REFUNDED,
      'ZWRÓCONE': PaymentStatus.REFUNDED,
      ZWROCONE: PaymentStatus.REFUNDED,
    };

    return map[str.toUpperCase().trim()] || PaymentStatus.COMPLETED;
  }
}

export default new CsvImportService();
