import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail, Users, Send, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { studentService } from '../services/studentService';
import mailingService from '../services/mailingService';

interface MailingFormData {
  subject: string;
  message: string;
  recipients: 'all' | 'selected';
  selectedStudentIds: string[];
}

const MailingsPage: React.FC = () => {
  const [formData, setFormData] = useState<MailingFormData>({
    subject: '',
    message: '',
    recipients: 'all',
    selectedStudentIds: [],
  });

  const [emailTemplate, setEmailTemplate] = useState<'welcome' | 'reminder' | 'custom'>('custom');

  // Fetch all students for selection
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents(),
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
  };

  const applyTemplate = (template: 'welcome' | 'reminder' | 'custom') => {
    setEmailTemplate(template);
    if (template !== 'custom') {
      setFormData({
        ...formData,
        subject: templates[template].subject,
        message: templates[template].message,
      });
    }
  };

  const sendMailingMutation = useMutation({
    mutationFn: async (data: MailingFormData) => {
      return await mailingService.sendBulkEmail({
        subject: data.subject,
        message: data.message,
        recipients: data.recipients,
        selectedStudentIds: data.recipients === 'selected' ? data.selectedStudentIds : undefined,
      });
    },
    onSuccess: (result) => {
      if (result.totalFailed > 0) {
        toast.success(
          `Wysłano ${result.totalSent} z ${result.totalRecipients} wiadomości. ${result.totalFailed} nie powiodło się.`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Wysłano ${result.totalSent} wiadomości!`);
      }
      setFormData({
        subject: '',
        message: '',
        recipients: 'all',
        selectedStudentIds: [],
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Recipients Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Odbiorcy
          </h2>

          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="all"
                  checked={formData.recipients === 'all'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipients: e.target.value as 'all' | 'selected',
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
                  value="selected"
                  checked={formData.recipients === 'selected'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipients: e.target.value as 'all' | 'selected',
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
