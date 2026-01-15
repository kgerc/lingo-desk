import React, { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail, Users, Send, Loader2, AlertCircle, Paperclip, X, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { studentService } from '../services/studentService';
import mailingService from '../services/mailingService';

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/zip',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB

interface MailingFormData {
  subject: string;
  message: string;
  recipients: 'all' | 'selected' | 'debtors';
  selectedStudentIds: string[];
  attachments: File[];
}

const MailingsPage: React.FC = () => {
  const [formData, setFormData] = useState<MailingFormData>({
    subject: '',
    message: '',
    recipients: 'all',
    selectedStudentIds: [],
    attachments: [],
  });

  const [emailTemplate, setEmailTemplate] = useState<'welcome' | 'reminder' | 'payment' | 'custom'>('custom');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all students for selection
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents(),
  });

  // Fetch debtors count
  const { data: debtorsCount = 0 } = useQuery({
    queryKey: ['debtors-count'],
    queryFn: () => mailingService.getDebtorsCount(),
  });

  // Email templates
  const templates = {
    welcome: {
      subject: 'Witamy w naszej szkole językowej!',
      message: `Dzień dobry!

Witamy Cię serdecznie w naszej szkole językowej!

Cieszymy się, że dołączyłeś do nas i rozpoczynasz swoją przygodę z nauką języka. Nasz zespół doświadczonych lektorów jest gotowy, aby pomóc Ci osiągnąć Twoje cele językowe.

Jeśli masz jakiekolwiek pytania lub potrzebujesz pomocy, nie wahaj się z nami skontaktować.

Powodzenia w nauce!

Z poważaniem,
Zespół szkoły`,
    },
    reminder: {
      subject: 'Przypomnienie o zajęciach',
      message: `Dzień dobry!

Przypominamy o Twoich zajęciach w naszej szkole językowej.

Prosimy o regularne uczestnictwo w lekcjach oraz wykonywanie zadań domowych - to klucz do sukcesu w nauce języka!

Jeśli masz jakieś pytania lub trudności, skontaktuj się z nami.

Powodzenia!

Z poważaniem,
Zespół szkoły`,
    },
    payment: {
      subject: 'Przypomnienie o zaległych płatnościach',
      message: `Dzień dobry!

Uprzejmie informujemy, że na Twoim koncie figurują zaległe płatności za zajęcia w naszej szkole językowej.

Prosimy o uregulowanie należności w najbliższym możliwym terminie, aby móc kontynuować naukę bez zakłóceń.

W przypadku pytań lub chęci ustalenia indywidualnego planu spłaty, prosimy o kontakt.

Dziękujemy za zrozumienie i współpracę.

Z poważaniem,
Zespół szkoły`,
    },
  };

  const applyTemplate = (template: 'welcome' | 'reminder' | 'payment' | 'custom') => {
    setEmailTemplate(template);
    if (template !== 'custom') {
      setFormData({
        ...formData,
        subject: templates[template].subject,
        message: templates[template].message,
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];

    // Validate file types
    const invalidFiles = files.filter(file => !ALLOWED_FILE_TYPES.includes(file.type));
    if (invalidFiles.length > 0) {
      toast.error(`Niedozwolony typ pliku: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Validate individual file sizes
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error(`Plik zbyt duży (max 10MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Validate total size
    const currentTotalSize = formData.attachments.reduce((sum, f) => sum + f.size, 0);
    const newTotalSize = currentTotalSize + files.reduce((sum, f) => sum + f.size, 0);
    if (newTotalSize > MAX_TOTAL_SIZE) {
      toast.error('Łączny rozmiar załączników nie może przekroczyć 25MB');
      return;
    }

    // Limit total number of files
    if (formData.attachments.length + files.length > 10) {
      toast.error('Maksymalnie 10 załączników');
      return;
    }

    setFormData({
      ...formData,
      attachments: [...formData.attachments, ...files],
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setFormData({
      ...formData,
      attachments: formData.attachments.filter((_, i) => i !== index),
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const sendMailingMutation = useMutation({
    mutationFn: async (data: MailingFormData) => {
      return await mailingService.sendBulkEmail({
        subject: data.subject,
        message: data.message,
        recipients: data.recipients,
        selectedStudentIds: data.recipients === 'selected' ? data.selectedStudentIds : undefined,
        attachments: data.attachments.length > 0 ? data.attachments : undefined,
      });
    },
    onSuccess: (result) => {
      let message = `Wysłano ${result.totalSent} z ${result.totalRecipients} wiadomości.`;
      if (result.totalFailed > 0) {
        message += ` ${result.totalFailed} nie powiodło się.`;
      }
      if (result.attachmentsIncluded && result.attachmentsIncluded > 0) {
        message += ` Załączniki: ${result.attachmentsIncluded}.`;
      }
      if (result.attachmentFailures && result.attachmentFailures > 0) {
        message += ` Błędy załączników: ${result.attachmentFailures}.`;
      }

      if (result.totalFailed > 0 || (result.attachmentFailures && result.attachmentFailures > 0)) {
        toast.success(message, { duration: 5000 });
      } else {
        toast.success(message);
      }
      setFormData({
        subject: '',
        message: '',
        recipients: 'all',
        selectedStudentIds: [],
        attachments: [],
      });
      setEmailTemplate('custom');
    },
    onError: () => {
      toast.error('Wystąpił błąd podczas wysyłania wiadomości');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.subject || !formData.message) {
      toast.error('Wypełnij temat i treść wiadomości');
      return;
    }

    if (formData.recipients === 'selected' && formData.selectedStudentIds.length === 0) {
      toast.error('Wybierz co najmniej jednego ucznia');
      return;
    }

    sendMailingMutation.mutate(formData);
  };

  const toggleStudentSelection = (studentId: string) => {
    setFormData({
      ...formData,
      selectedStudentIds: formData.selectedStudentIds.includes(studentId)
        ? formData.selectedStudentIds.filter((id) => id !== studentId)
        : [...formData.selectedStudentIds, studentId],
    });
  };

  const recipientCount =
    formData.recipients === 'all'
      ? students.length
      : formData.recipients === 'debtors'
      ? debtorsCount
      : formData.selectedStudentIds.length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          Mailingi
        </h1>
        <p className="text-gray-600 mt-2">
          Wyślij wiadomość powitalną lub przypominającą do uczniów
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Templates */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Szablon wiadomości
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => applyTemplate('welcome')}
              className={`p-4 rounded-lg border-2 transition-all ${
                emailTemplate === 'welcome'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-medium">Powitalna</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                Wiadomość powitalna dla nowych uczniów
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('reminder')}
              className={`p-4 rounded-lg border-2 transition-all ${
                emailTemplate === 'reminder'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-amber-600" />
                <span className="font-medium">Przypominająca</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                Przypomnienie o zajęciach i zaangażowaniu
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('payment')}
              className={`p-4 rounded-lg border-2 transition-all ${
                emailTemplate === 'payment'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium">Płatności</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                Przypomnienie o zaległych płatnościach
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('custom')}
              className={`p-4 rounded-lg border-2 transition-all ${
                emailTemplate === 'custom'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Niestandardowa</span>
              </div>
              <p className="text-sm text-gray-600 text-left">
                Stwórz własną wiadomość od podstaw
              </p>
            </button>
          </div>
        </div>

        {/* Email Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Treść wiadomości
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temat
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Wpisz temat wiadomości"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wiadomość
              </label>
              <textarea
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                rows={12}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                placeholder="Wpisz treść wiadomości"
              />
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Załączniki
          </h2>

          <div className="space-y-4">
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.txt,.csv,.zip"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Paperclip className="h-5 w-5 text-gray-600" />
                <span className="text-gray-700">Dodaj załącznik</span>
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Max 10 plików, 10MB każdy, 25MB łącznie. Dozwolone: PDF, Word, Excel, PowerPoint, obrazy, TXT, CSV, ZIP
              </p>
            </div>

            {formData.attachments.length > 0 && (
              <div className="space-y-2">
                {formData.attachments.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-500" />
                      <div>
                        <div className="font-medium text-gray-900 text-sm">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-600" />
                    </button>
                  </div>
                ))}
                <div className="text-sm text-gray-600 pt-2">
                  Łącznie: {formatFileSize(formData.attachments.reduce((sum, f) => sum + f.size, 0))} / 25MB
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recipients Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Odbiorcy
          </h2>

          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="all"
                  checked={formData.recipients === 'all'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipients: e.target.value as 'all' | 'selected' | 'debtors',
                    })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">
                  Wszyscy uczniowie ({students.length})
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="debtors"
                  checked={formData.recipients === 'debtors'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipients: e.target.value as 'all' | 'selected' | 'debtors',
                    })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">
                  Dłużnicy ({debtorsCount})
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="selected"
                  checked={formData.recipients === 'selected'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipients: e.target.value as 'all' | 'selected' | 'debtors',
                    })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-700">
                  Wybrani uczniowie
                </span>
              </label>
            </div>

            {formData.recipients === 'selected' && (
              <div className="mt-4">
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  {students.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      Brak uczniów w szkole
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {students.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selectedStudentIds.includes(
                              student.id
                            )}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="w-4 h-4 text-primary focus:ring-primary rounded"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {student.user.firstName} {student.user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {student.user.email}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
              <Users className="h-5 w-5" />
              <span className="font-medium">
                Wiadomość zostanie wysłana do {recipientCount}{' '}
                {recipientCount === 1
                  ? 'ucznia'
                  : recipientCount > 1 && recipientCount < 5
                  ? 'uczniów'
                  : 'uczniów'}
              </span>
            </div>

            <button
              type="submit"
              disabled={sendMailingMutation.isPending}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMailingMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Wyślij wiadomości
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MailingsPage;
