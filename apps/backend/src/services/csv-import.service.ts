import { GoogleGenerativeAI } from '@google/generative-ai';
import { parse } from 'csv-parse/sync';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import balanceService from './balance.service';

// System fields that CSV columns can be mapped to
// NOTE: 'email' removed - students are matched by name or bank account number
export const SYSTEM_FIELDS = [
  { key: 'date', label: 'Data płatności', required: true },
  { key: 'counterparty', label: 'Kontrahent', required: true },
  { key: 'description', label: 'Opis transakcji', required: false },
  { key: 'bankAccount', label: 'Numer konta', required: true },
  { key: 'amount', label: 'Kwota', required: true },
  { key: 'paymentMethod', label: 'Metoda płatności', required: false },
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

export interface UnmatchedPayment {
  row: number;
  date: string;
  counterparty: string;
  description: string;
  bankAccount: string;
  amount: number;
  paymentMethod: string;
  rawData: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data: string }>;
  unmatched: UnmatchedPayment[];
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

    let score = headerCount;

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
 * Parse CSV text into rows using csv-parse.
 * Filters out columns that are empty (blank header or all blank values).
 */
function parseCsv(text: string, separator: string): string[][] {
  let records: string[][];

  try {
    records = parse(text, {
      delimiter: separator,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch {
    records = text
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => line.split(separator).map((c) => c.trim()));
  }

  if (records.length < 2) return records;

  // Remove columns with empty header or fully empty values
  const headers = records[0];
  const dataRows = records.slice(1);

  const keepIndices: number[] = [];
  for (let col = 0; col < headers.length; col++) {
    const header = (headers[col] || '').trim();
    if (!header) continue; // blank header → skip column

    const hasAnyValue = dataRows.some((row) => (row[col] || '').trim() !== '');
    if (!hasAnyValue) continue; // all values empty → skip column

    keepIndices.push(col);
  }

  // Rebuild rows keeping only non-empty columns
  // We also remap csvColumnIndex to the NEW index within the filtered set
  const filteredRecords = records.map((row) => keepIndices.map((i) => row[i] || ''));

  return filteredRecords;
}

/**
 * Normalize a string for matching: lowercase, strip non-alphanumeric except Polish chars
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9ąćęłńóśźżü]/g, '');
}

/**
 * Normalize an IBAN/NRB account number: strip spaces, optional PL prefix → digits only
 */
function normalizeAccountNumber(raw: string): string {
  const stripped = raw.replace(/\s/g, '').toUpperCase();
  // Remove country prefix (PL, DE, etc.) if present
  return stripped.replace(/^[A-Z]{2}/, '');
}

/**
 * Rule-based column mapping (fallback when AI is unavailable)
 */
function ruleBasedMapping(headers: string[]): ColumnMapping[] {
  const aliases: Record<SystemFieldKey, string[]> = {
    date: ['date', 'data', 'datum', 'dataplatnosci', 'datawplaty', 'paymentdate', 'termin', 'dataoperacji', 'dataksiegowania'],
    counterparty: ['kontrahent', 'nadawca', 'zleceniodawca', 'odbiorca', 'counterparty', 'payer', 'sender', 'nazwa', 'podmiot'],
    description: ['opis', 'opistransakcji', 'opisoperacji', 'tytul', 'tytuł', 'tytulprzelewu', 'description', 'title', 'szczegoly', 'szczegóły'],
    bankAccount: ['nrkonta', 'numerokonta', 'konto', 'iban', 'nrb', 'account', 'accountnumber', 'rachuneknadawcy', 'rachunekzleceniodawcy'],
    amount: ['amount', 'kwota', 'suma', 'wartosc', 'wartość', 'cena', 'price', 'value', 'oplata', 'opłata', 'kwotaoperacji'],
    paymentMethod: [
      'paymentmethod', 'metodaplatnosci', 'metoda', 'payment', 'platnosc',
      'płatność', 'typplatnosci', 'sposob', 'sposób', 'method',
      'uznania', 'obciazenia', 'typoperacji', 'rodzajoperacji', 'operacja',
    ],
    status: ['status', 'stan', 'state'],
    notes: ['notes', 'notatki', 'uwagi', 'note', 'notatka', 'komentarz', 'comment'],
  };

  return headers.map((header, index) => {
    const normalized = normalize(header);

    let bestMatch: SystemFieldKey | null = null;
    let bestConfidence = 0;

    for (const [field, fieldAliases] of Object.entries(aliases) as [SystemFieldKey, string[]][]) {
      for (const alias of fieldAliases) {
        const normalizedAlias = normalize(alias);
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
- "counterparty" - payer name / kontrahent / nadawca / zleceniodawca (full name of the person)
- "description" - transaction description / opis transakcji / tytuł przelewu
- "bankAccount" - sender's bank account number (IBAN or NRB format)
- "amount" - payment amount (numeric)
- "paymentMethod" - payment method (cash, transfer, card, etc.) — also matches Polish bank "Typ operacji" column with values like "Uznania", "Obciążenia", "770 Przelew krajowy", "772 Przelew wewnętrzny"
- "status" - payment status (completed, pending, etc.)
- "notes" - notes/comments

Respond ONLY with a JSON array. Each element must have:
- "csvColumnIndex": number (0-based index)
- "systemField": string or null (one of: "date", "counterparty", "description", "bankAccount", "amount", "paymentMethod", "status", "notes", or null if no match)
- "confidence": number between 0 and 1

Rules:
- Each system field can be mapped to at most ONE csv column
- Columns that don't match any system field should have systemField: null
- Be generous with matching - column names may be in Polish, English, or other languages
- Consider sample data values (e.g., account numbers suggest "bankAccount", full names suggest "counterparty")
- Do NOT map any column to "email" - email mapping is not supported

JSON response:`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return ruleBasedMapping(headers);
    }

    const aiMapping: Array<{
      csvColumnIndex: number;
      systemField: SystemFieldKey | null;
      confidence: number;
    }> = JSON.parse(jsonMatch[0]);

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

  for (let i = 0; i < mapping.length; i++) {
    const m = mapping[i];
    if (!m.systemField) continue;

    const existing = fieldBestIndex.get(m.systemField);
    if (existing === undefined || m.confidence > mapping[existing].confidence) {
      fieldBestIndex.set(m.systemField, i);
    }
  }

  return mapping.map((m, i) => {
    if (!m.systemField) return m;
    if (fieldBestIndex.get(m.systemField) !== i) {
      return { ...m, systemField: null, confidence: 0 };
    }
    return m;
  });
}

/**
 * Find student by full name appearing in a text string (counterparty or description).
 * Tries exact match first, then partial (all name tokens present).
 */
async function findStudentByNameInText(
  text: string,
  organizationId: string
): Promise<{ id: string } | null> {
  if (!text.trim()) return null;

  const normalizedText = normalize(text);

  const students = await prisma.student.findMany({
    where: { organizationId },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  // 1st pass: exact full-name match (normalized)
  for (const s of students) {
    const fullName = normalize(`${s.user.firstName} ${s.user.lastName}`);
    const reverseName = normalize(`${s.user.lastName} ${s.user.firstName}`);
    if (normalizedText.includes(fullName) || normalizedText.includes(reverseName)) {
      return { id: s.id };
    }
  }

  // 2nd pass: all name tokens present in text
  for (const s of students) {
    const tokens = [normalize(s.user.firstName), normalize(s.user.lastName)].filter(Boolean);
    if (tokens.length >= 2 && tokens.every((t) => normalizedText.includes(t))) {
      return { id: s.id };
    }
  }

  return null;
}

/**
 * Find student by bank account number.
 * Normalizes both sides: strips spaces and optional country prefix.
 */
async function findStudentByBankAccount(
  accountRaw: string,
  organizationId: string
): Promise<{ id: string } | null> {
  if (!accountRaw.trim()) return null;

  const normalized = normalizeAccountNumber(accountRaw);
  if (normalized.length < 10) return null; // too short to be a real account number

  const students = await prisma.student.findMany({
    where: {
      organizationId,
      bankAccountNumber: { not: null },
    },
    select: { id: true, bankAccountNumber: true },
  });

  for (const s of students) {
    if (!s.bankAccountNumber) continue;
    if (normalizeAccountNumber(s.bankAccountNumber) === normalized) {
      return { id: s.id };
    }
  }

  return null;
}


/**
 * Try to find an existing student by bank account (primary), then by name in kontrahent/opis.
 * Returns { id, matchSource } if found, or null if not found (no auto-creation).
 */
async function findStudentFromImport(
  counterparty: string,
  description: string,
  bankAccount: string,
  organizationId: string,
): Promise<{ id: string; matchSource: string } | null> {
  // 1. Match by bank account number first (most reliable)
  if (bankAccount) {
    const s = await findStudentByBankAccount(bankAccount, organizationId);
    if (s) return { id: s.id, matchSource: 'numer konta' };
  }
  // 2. Match by name in counterparty field
  if (counterparty) {
    const s = await findStudentByNameInText(counterparty, organizationId);
    if (s) return { id: s.id, matchSource: 'kontrahent' };
  }
  // 3. Match by name in description
  if (description) {
    const s = await findStudentByNameInText(description, organizationId);
    if (s) return { id: s.id, matchSource: 'opis transakcji' };
  }
  return null;
}

class CsvImportService {
  /**
   * Analyze CSV file and propose column mapping
   */
  async analyzeCsv(csvData: string): Promise<CsvAnalysisResult> {
    const warnings: string[] = [];

    const separator = detectSeparator(csvData);
    const allRows = parseCsv(csvData, separator);

    if (allRows.length < 2) {
      throw new Error('Plik CSV jest pusty lub zawiera tylko nagłówek');
    }

    const headers = allRows[0];
    const dataRows = allRows.slice(1);
    const preview = dataRows.slice(0, 10);

    let mapping = await aiBasedMapping(headers, preview);
    mapping = deduplicateMapping(mapping);

    // Warn about required fields
    const mappedFields = mapping.filter((m) => m.systemField).map((m) => m.systemField);
    for (const field of SYSTEM_FIELDS) {
      if (field.required && !mappedFields.includes(field.key)) {
        warnings.push(`Nie znaleziono mapowania dla wymaganego pola: ${field.label}`);
      }
    }

    // Warn if neither counterparty nor description nor bankAccount is mapped
    const hasNameField = mappedFields.includes('counterparty') || mappedFields.includes('description');
    const hasBankField = mappedFields.includes('bankAccount');
    if (!hasNameField && !hasBankField) {
      warnings.push('Brak kolumny "Kontrahent", "Opis transakcji" lub "Numer konta" – uczniowie nie będą dopasowywani automatycznie');
    }

    // Warn about low confidence mappings
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
    const dataRows = allRows.slice(1);

    const results: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
      unmatched: [],
    };

    // Build field index map
    const fieldIndex: Partial<Record<SystemFieldKey, number>> = {};
    for (const m of mapping) {
      if (m.systemField) {
        fieldIndex[m.systemField] = m.csvColumnIndex;
      }
    }

    // Validate required fields are mapped
    const requiredFields: SystemFieldKey[] = ['date', 'counterparty', 'bankAccount', 'amount'];
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

    // Cache org currency to avoid N+1
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    });
    const currency = org?.currency || 'PLN';

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const rowText = row.join(separator);

      try {
        const getValue = (field: SystemFieldKey): string => {
          const idx = fieldIndex[field];
          return idx !== undefined && idx < row.length ? (row[idx] || '').trim() : '';
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

        // --- Student lookup ---
        const counterparty = getValue('counterparty');
        const description = getValue('description');
        const bankAccount = getValue('bankAccount');

        const amountStrEarly = getValue('amount');
        const amountEarly = parseFloat(amountStrEarly.replace(',', '.').replace(/[^\d.-]/g, ''));

        const studentResult = await findStudentFromImport(
          counterparty,
          description,
          bankAccount,
          organizationId,
        );

        if (!studentResult) {
          // Collect as unmatched — can be manually assigned from the UI
          results.unmatched.push({
            row: rowNum,
            date: getValue('date'),
            counterparty,
            description,
            bankAccount,
            amount: isNaN(amountEarly) ? 0 : amountEarly,
            paymentMethod: getValue('paymentMethod') || 'BANK_TRANSFER',
            rawData: rowText,
          });
          continue;
        }

        const student = { id: studentResult.id };
        const matchSource = studentResult.matchSource;

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

        // Parse payment method (defaults to BANK_TRANSFER when not mapped or unrecognized)
        const methodStr = getValue('paymentMethod');
        const paymentMethod = this.parsePaymentMethod(methodStr) || PaymentMethod.BANK_TRANSFER;

        // Parse status (optional, defaults to COMPLETED)
        const statusStr = getValue('status');
        const status = statusStr ? this.parseStatus(statusStr) : PaymentStatus.COMPLETED;

        // Notes: use explicit notes field, fall back to description if notes not mapped
        const notesValue = getValue('notes') || (!fieldIndex['notes'] && description ? description : null);
        const notes = notesValue || null;

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
            `Import CSV - wpłata z dnia ${dateStr} (dopasowano po: ${matchSource})`
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

    // DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (dmyMatch) {
      const d = new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }

    // YYYY-MM-DD
    const ymdMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) return d;
    }

    // DD-MM-YYYY
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
    const upper = str.toUpperCase().trim();

    const exactMap: Record<string, PaymentMethod> = {
      STRIPE: PaymentMethod.STRIPE,
      CASH: PaymentMethod.CASH,
      'GOTÓWKA': PaymentMethod.CASH,
      GOTOWKA: PaymentMethod.CASH,
      BANK_TRANSFER: PaymentMethod.BANK_TRANSFER,
      PRZELEW: PaymentMethod.BANK_TRANSFER,
      TRANSFER: PaymentMethod.BANK_TRANSFER,
      KARTA: PaymentMethod.CASH,
      // Polish bank "Typ operacji" column values
      UZNANIA: PaymentMethod.BANK_TRANSFER,      // credit (incoming transfer)
      'UZNANIE': PaymentMethod.BANK_TRANSFER,
      'OBCIĄŻENIA': PaymentMethod.BANK_TRANSFER, // debit (outgoing transfer)
      OBCIAZENIA: PaymentMethod.BANK_TRANSFER,
      'OBCIĄŻENIE': PaymentMethod.BANK_TRANSFER,
      OBCIAZENIE: PaymentMethod.BANK_TRANSFER,
    };

    if (exactMap[upper]) return exactMap[upper];

    // Prefix / substring matching for verbose bank descriptions
    // e.g. "770 Przelew krajowy; z rach.: ..." or "772 Przelew wewnętrzny; ..."
    if (upper.includes('PRZELEW')) return PaymentMethod.BANK_TRANSFER;
    if (upper.includes('TRANSFER')) return PaymentMethod.BANK_TRANSFER;
    if (upper.includes('UZNANI')) return PaymentMethod.BANK_TRANSFER;
    if (upper.includes('GOTÓWK') || upper.includes('GOTOWK') || upper.includes('CASH')) return PaymentMethod.CASH;
    if (upper.includes('KARTA') || upper.includes('CARD')) return PaymentMethod.CASH;
    if (upper.includes('STRIPE')) return PaymentMethod.STRIPE;

    return null;
  }

  /**
   * Import a single previously-unmatched payment by assigning it to a specific student.
   */
  async importUnmatchedPayment(
    unmatched: UnmatchedPayment,
    studentId: string,
    organizationId: string,
  ): Promise<void> {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    });
    const currency = org?.currency || 'PLN';

    const paidAt = this.parseDate(unmatched.date);
    if (!paidAt) throw new Error(`Nieprawidłowy format daty: "${unmatched.date}"`);

    const paymentMethod = this.parsePaymentMethod(unmatched.paymentMethod) || PaymentMethod.BANK_TRANSFER;

    const payment = await prisma.payment.create({
      data: {
        organizationId,
        studentId,
        amount: unmatched.amount,
        currency,
        status: PaymentStatus.COMPLETED,
        paymentMethod,
        paidAt,
        notes: unmatched.description || null,
      },
    });

    await balanceService.addDeposit(
      studentId,
      organizationId,
      unmatched.amount,
      payment.id,
      `Import CSV (ręczne przypisanie) - wpłata z dnia ${unmatched.date}`
    );
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
