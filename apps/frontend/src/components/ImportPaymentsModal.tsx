import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Upload, FileText, AlertCircle, CheckCircle2,
  Download, ArrowRight, ArrowLeft, Columns, Eye, Loader2,
} from 'lucide-react';
import paymentService, {
  ColumnMapping, CsvAnalysisResult, SYSTEM_FIELDS, SystemFieldKey,
} from '../services/paymentService';
import toast from 'react-hot-toast';

/** Count Polish diacritic characters in a string (higher = better decode quality). */
function countPolishChars(text: string): number {
  return (text.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
}

/**
 * Read file trying multiple encodings. Polish bank exports often use Windows-1250.
 *
 * Strategy: always try all candidate encodings and pick the one that produces
 * the most Polish diacritic characters. This handles the edge case where
 * file.text() (UTF-8) silently replaces bytes without emitting U+FFFD,
 * which made the old "check for replacement char" heuristic unreliable.
 */
async function readFileWithEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();

  const candidates: Array<{ encoding: string; text: string; score: number }> = [];

  // UTF-8 via native browser API
  const utf8Text = await file.text();
  // Penalise UTF-8 result if it still contains replacement chars
  const utf8Score = utf8Text.includes('\uFFFD')
    ? -1
    : countPolishChars(utf8Text);
  candidates.push({ encoding: 'utf-8', text: utf8Text, score: utf8Score });

  // Try single-byte encodings used by Polish banks.
  // windows-1250 is the de-facto standard for Polish bank exports.
  // iso-8859-2 overlaps heavily with windows-1250 for Polish chars but differs in
  // the 0x80-0x9F range, which can produce false positives. We intentionally
  // exclude iso-8859-2 to prevent it from winning over windows-1250.
  for (const encoding of ['windows-1250', 'windows-1252'] as const) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: false });
      const text = decoder.decode(buffer);
      candidates.push({ encoding, text, score: countPolishChars(text) });
    } catch {
      // encoding not supported in this browser - skip
    }
  }

  // Pick the encoding that yielded the most Polish characters.
  // If all scores are equal (e.g. file has no Polish chars at all), utf-8 wins
  // because it appears first and sort is stable.
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].text;
}

interface ImportPaymentsModalProps {
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'results';

const ImportPaymentsModal: React.FC<ImportPaymentsModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);

  // Analysis state
  const [analysis, setAnalysis] = useState<CsvAnalysisResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);

  // Results state
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string; data: string }>;
  } | null>(null);

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: (data: string) => paymentService.analyzeCsvImport(data),
    onSuccess: (data) => {
      setAnalysis(data);
      setMapping(data.mapping);
      setStep('mapping');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Błąd podczas analizy pliku CSV');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: () =>
      paymentService.executeCsvImport(csvData, mapping, analysis!.separator),
    onSuccess: (data) => {
      setImportResults(data);
      setStep('results');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });

      if (data.failed === 0) {
        toast.success(`Import zakończony pomyślnie: ${data.success} transakcji`);
      } else {
        toast.success(`Import zakończony: ${data.success} sukces, ${data.failed} błędów`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Błąd podczas importu płatności');
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Proszę wybrać plik CSV');
      return;
    }
    setCsvFile(file);
    setAnalysis(null);
    setMapping([]);
    setImportResults(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleAnalyze = async () => {
    if (!csvFile) return;
    try {
      // Try reading with multiple encodings - Polish bank exports often use Windows-1250
      let text = await readFileWithEncoding(csvFile);
      setCsvData(text);
      analyzeMutation.mutate(text);
    } catch {
      toast.error('Błąd podczas odczytu pliku');
    }
  };

  const handleMappingChange = (csvColumnIndex: number, systemField: SystemFieldKey | null) => {
    setMapping((prev) => {
      // Clear previous mapping of this system field (if any other column had it)
      const updated = prev.map((m) => {
        if (systemField && m.systemField === systemField && m.csvColumnIndex !== csvColumnIndex) {
          return { ...m, systemField: null, confidence: 0 };
        }
        return m;
      });

      // Set new mapping
      return updated.map((m) =>
        m.csvColumnIndex === csvColumnIndex
          ? { ...m, systemField, confidence: systemField ? 1 : 0 }
          : m
      );
    });
  };

  const handleImport = () => {
    importMutation.mutate();
  };

  const downloadTemplate = () => {
    const template = `data,kontrahent,opisTransakcji,nrKonta,kwota,metodaPlatnosci,status,notatki
2025-01-15,Jan Kowalski,Opłata za kurs angielskiego,PL61109010140000071219812874,200,CASH,COMPLETED,Styczeń
2025-01-16,Anna Nowak,Przelew za lekcje,PL27114020040000300201355387,150,BANK_TRANSFER,PENDING,`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'szablon-platnosci.csv';
    link.click();
  };

  // Check if required fields are mapped
  const requiredFieldsMapped = SYSTEM_FIELDS
    .filter((f) => f.required)
    .every((f) => mapping.some((m) => m.systemField === f.key));

  const isLoading = analyzeMutation.isPending || importMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-gray-900">Import wpłat z CSV</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 text-sm">
            {[
              { key: 'upload' as Step, label: 'Plik', icon: Upload },
              { key: 'mapping' as Step, label: 'Mapowanie', icon: Columns },
              { key: 'preview' as Step, label: 'Podgląd', icon: Eye },
              { key: 'results' as Step, label: 'Wyniki', icon: CheckCircle2 },
            ].map(({ key, label, icon: Icon }, idx) => (
              <React.Fragment key={key}>
                {idx > 0 && <ArrowRight className="h-4 w-4 text-gray-300" />}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                    step === key
                      ? 'bg-primary/10 text-primary font-medium'
                      : key === 'results' && importResults
                        ? 'text-green-600'
                        : 'text-gray-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'upload' && <UploadStep
            csvFile={csvFile}
            isDragOver={isDragOver}
            isLoading={analyzeMutation.isPending}
            onFileChange={handleFileChange}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDownloadTemplate={downloadTemplate}
          />}

          {step === 'mapping' && analysis && <MappingStep
            analysis={analysis}
            mapping={mapping}
            onMappingChange={handleMappingChange}
          />}

          {step === 'preview' && analysis && <PreviewStep
            analysis={analysis}
            mapping={mapping}
          />}

          {step === 'results' && importResults && <ResultsStep
            results={importResults}
          />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between rounded-b-lg flex-shrink-0">
          <div>
            {(step === 'mapping' || step === 'preview') && (
              <button
                onClick={() => setStep(step === 'preview' ? 'mapping' : 'upload')}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
                Wstecz
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
            >
              {step === 'results' ? 'Zamknij' : 'Anuluj'}
            </button>

            {step === 'upload' && (
              <button
                onClick={handleAnalyze}
                disabled={!csvFile || analyzeMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analizowanie...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4" />
                    Analizuj plik
                  </>
                )}
              </button>
            )}

            {step === 'mapping' && (
              <button
                onClick={() => setStep('preview')}
                disabled={!requiredFieldsMapped}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Eye className="h-4 w-4" />
                Podgląd danych
              </button>
            )}

            {step === 'preview' && (
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importowanie...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Importuj {analysis?.rowCount} wierszy
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Step 1: Upload ──────────────────────────────────────────────

interface UploadStepProps {
  csvFile: File | null;
  isDragOver: boolean;
  isLoading: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDownloadTemplate: () => void;
}

const UploadStep: React.FC<UploadStepProps> = ({
  csvFile, isDragOver, isLoading, onFileChange, onDragOver, onDragLeave, onDrop, onDownloadTemplate,
}) => (
  <div className="space-y-6">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900 mb-2">Inteligentny import CSV</h3>
          <p className="text-sm text-blue-800 mb-2">
            System automatycznie rozpozna kolumny w pliku CSV - niezależnie od języka, kolejności i formatu.
            Po analizie będziesz mógł zweryfikować i poprawić mapowanie kolumn przed importem.
          </p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Obsługiwane separatory: przecinek, średnik, tabulator</li>
            <li>Obsługiwane formaty dat: YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY</li>
            <li>Obsługiwane kodowania: UTF-8, Windows-1250 (polskie banki), ISO-8859-2</li>
            <li>Dopasowanie ucznia: po imieniu i nazwisku w kolumnie „Kontrahent" lub „Opis transakcji", lub po numerze konta (IBAN/NRB)</li>
            <li>Puste kolumny są automatycznie pomijane</li>
          </ul>
          <button
            onClick={onDownloadTemplate}
            className="mt-3 flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium"
          >
            <Download className="h-4 w-4" />
            Pobierz przykładowy szablon
          </button>
        </div>
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Wybierz plik CSV</label>
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-primary'
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="file"
          id="csv-upload"
          onChange={onFileChange}
          accept=".csv"
          className="hidden"
          disabled={isLoading}
        />
        <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
          {csvFile ? (
            <>
              <FileText className="h-12 w-12 text-primary mb-2" />
              <p className="text-sm font-medium text-gray-900">{csvFile.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(csvFile.size / 1024).toFixed(2)} KB
              </p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400 mb-2" />
              <p className="text-sm font-medium text-gray-900">
                Przeciągnij plik CSV tutaj lub kliknij aby wybrać
              </p>
              <p className="text-xs text-gray-500 mt-1">Obsługiwane formaty: CSV</p>
            </>
          )}
        </label>
      </div>
    </div>
  </div>
);

// ── Step 2: Column Mapping ──────────────────────────────────────

interface MappingStepProps {
  analysis: CsvAnalysisResult;
  mapping: ColumnMapping[];
  onMappingChange: (csvColumnIndex: number, systemField: SystemFieldKey | null) => void;
}

const MappingStep: React.FC<MappingStepProps> = ({ analysis, mapping, onMappingChange }) => {
  const usedFields = new Set(mapping.filter((m) => m.systemField).map((m) => m.systemField));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Mapowanie kolumn</h3>
          <p className="text-sm text-gray-500">
            Rozpoznano {analysis.rowCount} wierszy danych. Sprawdź i popraw mapowanie kolumn.
          </p>
        </div>
        <span className="text-xs text-gray-400">
          Separator: {analysis.separator === ',' ? 'przecinek' : analysis.separator === ';' ? 'średnik' : 'tabulator'}
        </span>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              {analysis.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mapping table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-700">Kolumna CSV</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-700">Przykładowe dane</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-700">Pole systemowe</th>
              <th className="text-center px-4 py-2.5 font-medium text-gray-700 w-20">Pewność</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mapping.map((m) => {
              const sampleValues = analysis.preview
                .slice(0, 3)
                .map((row) => row[m.csvColumnIndex] || '')
                .filter(Boolean);

              return (
                <tr key={m.csvColumnIndex} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-800">
                    {m.csvColumn}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-48 truncate">
                    {sampleValues.join(', ')}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={m.systemField || ''}
                      onChange={(e) =>
                        onMappingChange(
                          m.csvColumnIndex,
                          (e.target.value as SystemFieldKey) || null
                        )
                      }
                      className={`w-full text-sm border rounded-md px-2 py-1.5 ${
                        m.systemField
                          ? 'border-green-300 bg-green-50 text-green-800'
                          : 'border-gray-300 text-gray-500'
                      }`}
                    >
                      <option value="">— Pomiń —</option>
                      {SYSTEM_FIELDS.map((f) => (
                        <option
                          key={f.key}
                          value={f.key}
                          disabled={usedFields.has(f.key) && m.systemField !== f.key}
                        >
                          {f.label}{f.required ? ' *' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {m.systemField && (
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          m.confidence >= 0.8
                            ? 'bg-green-500'
                            : m.confidence >= 0.5
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        title={`${Math.round(m.confidence * 100)}%`}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Required fields status */}
      <div className="flex flex-wrap gap-2">
        {SYSTEM_FIELDS.filter((f) => f.required).map((f) => {
          const isMapped = mapping.some((m) => m.systemField === f.key);
          return (
            <span
              key={f.key}
              className={`text-xs px-2.5 py-1 rounded-full ${
                isMapped
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isMapped ? '✓' : '✗'} {f.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ── Step 3: Preview ─────────────────────────────────────────────

interface PreviewStepProps {
  analysis: CsvAnalysisResult;
  mapping: ColumnMapping[];
}

const PreviewStep: React.FC<PreviewStepProps> = ({ analysis, mapping }) => {
  const mappedFields = mapping.filter((m) => m.systemField);
  const fieldOrder: SystemFieldKey[] = ['date', 'counterparty', 'description', 'bankAccount', 'amount', 'paymentMethod', 'status', 'notes'];
  const sortedFields = fieldOrder
    .map((key) => mappedFields.find((m) => m.systemField === key))
    .filter(Boolean) as ColumnMapping[];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">Podgląd danych</h3>
        <p className="text-sm text-gray-500">
          Pierwsze {Math.min(10, analysis.preview.length)} z {analysis.rowCount} wierszy.
          Sprawdź poprawność danych przed importem.
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-10">#</th>
              {sortedFields.map((m) => {
                const field = SYSTEM_FIELDS.find((f) => f.key === m.systemField);
                return (
                  <th key={m.csvColumnIndex} className="text-left px-3 py-2 font-medium text-gray-700 text-xs">
                    {field?.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {analysis.preview.slice(0, 10).map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-400">{rowIdx + 1}</td>
                {sortedFields.map((m) => (
                  <td key={m.csvColumnIndex} className="px-3 py-2 text-xs text-gray-800 max-w-40 truncate">
                    {row[m.csvColumnIndex] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analysis.rowCount > 10 && (
        <p className="text-xs text-gray-400 text-center">
          ...i {analysis.rowCount - 10} więcej wierszy
        </p>
      )}
    </div>
  );
};

// ── Step 4: Results ─────────────────────────────────────────────

interface ResultsStepProps {
  results: {
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string; data: string }>;
  };
}

const ResultsStep: React.FC<ResultsStepProps> = ({ results }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-900">Pomyślnie zaimportowano</p>
            <p className="text-2xl font-bold text-green-700">{results.success}</p>
          </div>
        </div>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-900">Błędy</p>
            <p className="text-2xl font-bold text-red-700">{results.failed}</p>
          </div>
        </div>
      </div>
    </div>

    {results.errors.length > 0 && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
        <h4 className="font-semibold text-red-900 mb-2">Szczegóły błędów:</h4>
        <div className="space-y-2">
          {results.errors.map((error, index) => (
            <div key={index} className="text-sm">
              <p className="font-medium text-red-800">Wiersz {error.row}:</p>
              <p className="text-red-700">{error.error}</p>
              {error.data && (
                <p className="text-red-600 text-xs font-mono bg-red-100 p-1 rounded mt-1">
                  {error.data}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default ImportPaymentsModal;
