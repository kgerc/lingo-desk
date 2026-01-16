import React, { useState, useRef } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { studentService } from '../services/studentService';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

interface ImportStudentsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface PreviewData {
  headers: string[];
  preview: Record<string, string>[];
  suggestedMapping: Record<string, string>;
}

interface ImportResults {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

type ImportStep = 'upload' | 'mapping' | 'importing' | 'results';

const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (content: string) => studentService.previewCSV(content),
    onSuccess: (data) => {
      setPreviewData(data);
      setColumnMapping(data.suggestedMapping);
      setStep('mapping');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd podczas przetwarzania pliku CSV');
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: ({ content, mapping }: { content: string; mapping: Record<string, string> }) =>
      studentService.importCSV(content, mapping),
    onSuccess: (data) => {
      setImportResults(data);
      setStep('results');
      if (data.successful > 0) {
        onSuccess();
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd podczas importu');
      setStep('mapping');
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Proszę wybrać plik CSV');
      return;
    }

    setFile(selectedFile);

    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      previewMutation.mutate(content);
    };
    reader.onerror = () => {
      toast.error('Błąd podczas odczytu pliku');
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      const fakeEvent = {
        target: { files: [droppedFile] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    } else {
      toast.error('Proszę wybrać plik CSV');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleImport = () => {
    // Validate required mappings
    if (!columnMapping.email || !columnMapping.firstName || !columnMapping.lastName) {
      toast.error('Email, Imię i Nazwisko są wymagane');
      return;
    }

    setStep('importing');
    importMutation.mutate({ content: csvContent, mapping: columnMapping });
  };

  const downloadTemplate = () => {
    const template = `email,firstName,lastName,phone,dateOfBirth,address,languageLevel,goals,isMinor,paymentDueDays,paymentDueDayOfMonth
jan.kowalski@example.com,Jan,Kowalski,+48123456789,1990-01-15,ul. Przykładowa 1,A1,Nauka konwersacji,false,7,
anna.nowak@example.com,Anna,Nowak,+48987654321,1985-05-20,ul. Testowa 2,B1,Przygotowanie do egzaminu,false,,15`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'szablon_import_uczniow.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const requiredFields = [
    { key: 'email', label: 'Email', required: true },
    { key: 'firstName', label: 'Imię', required: true },
    { key: 'lastName', label: 'Nazwisko', required: true },
  ];

  const optionalFields = [
    { key: 'phone', label: 'Telefon', required: false },
    { key: 'dateOfBirth', label: 'Data urodzenia', required: false },
    { key: 'address', label: 'Adres', required: false },
    { key: 'languageLevel', label: 'Poziom języka (A1-C2)', required: false },
    { key: 'goals', label: 'Cele', required: false },
    { key: 'isMinor', label: 'Nieletni (true/false)', required: false },
    { key: 'paymentDueDays', label: 'Termin płatności (dni)', required: false },
    { key: 'paymentDueDayOfMonth', label: 'Termin płatności (dzień miesiąca)', required: false },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Import uczniów z CSV</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">Wymagania:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Plik musi być w formacie CSV</li>
                    <li>Pierwsza linia powinna zawierać nagłówki kolumn</li>
                    <li>Wymagane kolumny: email, imię, nazwisko</li>
                    <li>Domyślne hasło dla wszystkich: LingoDesk2024!</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                >
                  <Download className="h-5 w-5" />
                  Pobierz szablon CSV
                </button>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">
                  {file ? file.name : 'Przeciągnij plik CSV tutaj'}
                </p>
                <p className="text-sm text-gray-500">
                  lub kliknij aby wybrać plik
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {previewMutation.isPending && (
                <div className="flex justify-center">
                  <LoadingSpinner message="Przetwarzanie pliku..." />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && previewData && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  Znaleziono {previewData.preview.length} wierszy do zaimportowania.
                  Zmapuj kolumny z pliku CSV do pól systemu.
                </div>
              </div>

              {/* Preview table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700">Podgląd danych (pierwsze 5 wierszy)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        {previewData.headers.map((header) => (
                          <th key={header} className="px-4 py-2 text-left font-medium text-gray-700">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview.map((row, idx) => (
                        <tr key={idx} className="border-t border-gray-200">
                          {previewData.headers.map((header) => (
                            <td key={header} className="px-4 py-2 text-gray-600">
                              {row[header]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column mapping */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Mapowanie kolumn</h3>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">Pola wymagane:</p>
                  {requiredFields.map((field) => (
                    <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                      <label className="text-sm font-medium text-gray-700">
                        {field.label} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- Wybierz kolumnę --</option>
                        {previewData.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700">Pola opcjonalne:</p>
                  {optionalFields.map((field) => (
                    <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                      <label className="text-sm text-gray-600">{field.label}</label>
                      <select
                        value={columnMapping[field.key] || ''}
                        onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">-- Pomiń --</option>
                        {previewData.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep('upload')}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Wstecz
                </button>
                <button
                  onClick={handleImport}
                  disabled={!columnMapping.email || !columnMapping.firstName || !columnMapping.lastName}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Rozpocznij import
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <LoadingSpinner message="Importowanie uczniów..." />
              <p className="mt-4 text-sm text-gray-600">
                To może chwilę potrwać dla dużych plików...
              </p>
            </div>
          )}

          {/* Step 4: Results */}
          {step === 'results' && importResults && (
            <div className="space-y-6">
              <div className={`border rounded-lg p-6 ${
                importResults.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  {importResults.failed === 0 ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-yellow-600" />
                  )}
                  <h3 className="text-xl font-semibold text-gray-900">Podsumowanie importu</h3>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-gray-900">{importResults.total}</div>
                    <div className="text-sm text-gray-600">Wszystkich</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600">{importResults.successful}</div>
                    <div className="text-sm text-gray-600">Udanych</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-600">{importResults.failed}</div>
                    <div className="text-sm text-gray-600">Nieudanych</div>
                  </div>
                </div>
              </div>

              {importResults.errors.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                    <h3 className="text-sm font-medium text-red-800">Błędy ({importResults.errors.length})</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Wiersz</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-700">Błąd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.errors.map((error, idx) => (
                          <tr key={idx} className="border-t border-gray-200">
                            <td className="px-4 py-2 text-gray-600">{error.row}</td>
                            <td className="px-4 py-2 text-gray-600">{error.email}</td>
                            <td className="px-4 py-2 text-red-600">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Zamknij
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportStudentsModal;
