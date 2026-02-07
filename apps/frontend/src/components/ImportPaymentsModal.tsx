import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import paymentService from '../services/paymentService';
import toast from 'react-hot-toast';

interface ImportPaymentsModalProps {
  onClose: () => void;
}

const ImportPaymentsModal: React.FC<ImportPaymentsModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string; data: string }>;
  } | null>(null);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const response = await paymentService.importPayments(csvData);
      return response;
    },
    onSuccess: (data) => {
      setImportResults(data);
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
    setImportResults(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
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
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleImport = async () => {
    if (!csvFile) {
      toast.error('Proszę wybrać plik CSV');
      return;
    }

    try {
      const text = await csvFile.text();
      importMutation.mutate(text);
    } catch (error) {
      toast.error('Błąd podczas odczytu pliku');
    }
  };

  const downloadTemplate = () => {
    const template = `data,email,kwota,metodaPlatnosci,status,notatki
2025-01-15,student@example.com,200,CASH,COMPLETED,Opłata za styczeń
2025-01-16,inny@example.com,150,BANK_TRANSFER,PENDING,`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'szablon-platnosci.csv';
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Upload className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold text-gray-900">Import wpłat z CSV</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Format pliku CSV</h3>
                <p className="text-sm text-blue-800 mb-2">
                  Plik CSV powinien zawierać następujące kolumny (oddzielone przecinkami).
                  System akceptuje różne warianty nazw kolumn (wielkość liter nie ma znaczenia):
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li><strong>data/date</strong> - format YYYY-MM-DD lub DD/MM/YYYY (np. 2025-01-15)</li>
                  <li><strong>email/uczen</strong> - email ucznia (np. student@example.com)</li>
                  <li><strong>kwota/amount</strong> - kwota płatności (np. 200 lub 200.50)</li>
                  <li><strong>metodaPlatnosci/metoda/payment</strong> - CASH/GOTÓWKA, BANK_TRANSFER/PRZELEW lub STRIPE</li>
                  <li><strong>status/stan</strong> - COMPLETED/OPŁACONE, PENDING/OCZEKUJĄCE, FAILED, REFUNDED (opcjonalnie)</li>
                  <li><strong>notatki/notes</strong> - dodatkowe informacje (opcjonalnie)</li>
                </ul>
                <p className="text-xs text-blue-700 mt-2 italic">
                  Kolumny mogą być w dowolnej kolejności. System automatycznie rozpozna polskie i angielskie nazwy.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="mt-3 flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium"
                >
                  <Download className="h-4 w-4" />
                  Pobierz przykładowy szablon
                </button>
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Wybierz plik CSV
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:border-primary'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="csv-upload"
                onChange={handleFileChange}
                accept=".csv"
                className="hidden"
                disabled={importMutation.isPending}
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center"
              >
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
                    <p className="text-xs text-gray-500 mt-1">
                      Obsługiwane formaty: CSV
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Import Results */}
          {importResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Pomyślnie zaimportowano</p>
                      <p className="text-2xl font-bold text-green-700">{importResults.success}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="text-sm font-medium text-red-900">Błędy</p>
                      <p className="text-2xl font-bold text-red-700">{importResults.failed}</p>
                    </div>
                  </div>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <h4 className="font-semibold text-red-900 mb-2">Szczegóły błędów:</h4>
                  <div className="space-y-2">
                    {importResults.errors.map((error, index) => (
                      <div key={index} className="text-sm">
                        <p className="font-medium text-red-800">Wiersz {error.row}:</p>
                        <p className="text-red-700">{error.error}</p>
                        <p className="text-red-600 text-xs font-mono bg-red-100 p-1 rounded mt-1">
                          {error.data}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={importMutation.isPending}
          >
            {importResults ? 'Zamknij' : 'Anuluj'}
          </button>
          {!importResults && (
            <button
              onClick={handleImport}
              disabled={!csvFile || importMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importMutation.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Importowanie...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importuj płatności
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportPaymentsModal;
