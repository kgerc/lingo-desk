import React, { useState, useRef, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail, Users, Send, Loader2, AlertCircle, Paperclip, X, FileText, Star, ClipboardList, MessageSquareWarning, Calendar, Eye, BookOpen, GraduationCap } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { studentService } from '../services/studentService';
import { courseService } from '../services/courseService';
import { lessonService } from '../services/lessonService';
import mailingService from '../services/mailingService';
import type { MailType } from '../services/mailingService';
import SearchableSelect from '../components/SearchableSelect';

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

type RecipientType = 'all' | 'selected' | 'debtors' | 'course' | 'lesson';

interface MailingFormData {
  subject: string;
  message: string;
  mailType: MailType;
  recipients: RecipientType;
  selectedStudentIds: string[];
  courseId: string;
  lessonId: string;
  scheduledAt: string;
  attachments: File[];
}

const MailingsPage: React.FC = () => {
  const [formData, setFormData] = useState<MailingFormData>({
    subject: '',
    message: '',
    mailType: 'custom',
    recipients: 'all',
    selectedStudentIds: [],
    courseId: '',
    lessonId: '',
    scheduledAt: '',
    attachments: [],
  });

  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all students for selection
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents(),
  });

  // Fetch courses for course recipient selection
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses({ isActive: true }),
  });

  // Fetch lessons for lesson recipient selection (only when course is selected)
  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons', formData.courseId],
    queryFn: () => lessonService.getLessons({ courseId: formData.courseId }),
    enabled: formData.recipients === 'lesson' && !!formData.courseId,
  });

  // Fetch debtors count
  const { data: debtorsCount = 0 } = useQuery({
    queryKey: ['debtors-count'],
    queryFn: () => mailingService.getDebtorsCount(),
  });

  // Email templates
  const templates: Record<string, { subject: string; message: string }> = {
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
    'teacher-rating': {
      subject: 'Oceń swojego lektora',
      message: `Dzień dobry!

Zależy nam na jakości naszych zajęć i chcielibyśmy poznać Twoją opinię na temat lektora prowadzącego Twoje zajęcia.

Prosimy o odpowiedź na kilka krótkich pytań:

1. Jak oceniasz przygotowanie lektora do zajęć? (1-5)
2. Jak oceniasz komunikację i podejście lektora? (1-5)
3. Czy lektor dostosowuje tempo nauki do Twoich potrzeb? (Tak/Nie)
4. Co lektor robi szczególnie dobrze?
5. Co lektor mógłby poprawić?

Twoja opinia jest dla nas bardzo cenna i pomoże nam podnosić jakość nauczania.

Dziękujemy za poświęcony czas!

Z poważaniem,
Zespół szkoły`,
    },
    survey: {
      subject: 'Ankieta satysfakcji',
      message: `Dzień dobry!

Chcielibyśmy poznać Twoją opinię o naszej szkole językowej. Prosimy o wypełnienie krótkiej ankiety:

1. Jak oceniasz ogólną jakość nauczania? (1-5)
2. Jak oceniasz organizację zajęć? (1-5)
3. Jak oceniasz materiały dydaktyczne? (1-5)
4. Czy poleciłbyś naszą szkołę znajomym? (Tak/Nie)
5. Co moglibyśmy poprawić?
6. Co szczególnie Ci się podoba?

Twoja opinia pomoże nam doskonalić nasze usługi.

Dziękujemy!

Z poważaniem,
Zespół szkoły`,
    },
    complaint: {
      subject: 'Odpowiedź na zgłoszenie reklamacyjne',
      message: `Dzień dobry!

Dziękujemy za zgłoszenie. Informujemy, że Twoja reklamacja została przyjęta i jest rozpatrywana.

Numer zgłoszenia: [NUMER]
Data przyjęcia: [DATA]

Postaramy się rozpatrzyć Twoje zgłoszenie w ciągu 14 dni roboczych. O wyniku poinformujemy Cię drogą mailową.

W przypadku pytań dotyczących statusu zgłoszenia, prosimy o kontakt.

Z poważaniem,
Zespół szkoły`,
    },
  };

  const applyTemplate = (template: MailType) => {
    setFormData(prev => ({
      ...prev,
      mailType: template,
      ...(template !== 'custom' && templates[template] ? {
        subject: templates[template].subject,
        message: templates[template].message,
      } : {}),
    }));
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
        mailType: data.mailType,
        recipients: data.recipients,
        selectedStudentIds: data.recipients === 'selected' ? data.selectedStudentIds : undefined,
        courseId: (data.recipients === 'course' || data.recipients === 'lesson') ? data.courseId : undefined,
        lessonId: data.recipients === 'lesson' ? data.lessonId : undefined,
        scheduledAt: data.scheduledAt || undefined,
        attachments: data.attachments.length > 0 ? data.attachments : undefined,
      });
    },
    onSuccess: (result) => {
      if (result.scheduled) {
        toast.success(`Wiadomość zaplanowana na ${new Date(result.scheduledAt!).toLocaleString('pl-PL')}`);
      } else {
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
      }
      setFormData({
        subject: '',
        message: '',
        mailType: 'custom',
        recipients: 'all',
        selectedStudentIds: [],
        courseId: '',
        lessonId: '',
        scheduledAt: '',
        attachments: [],
      });
      setShowPreview(false);
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

    if (formData.recipients === 'course' && !formData.courseId) {
      toast.error('Wybierz kurs');
      return;
    }

    if (formData.recipients === 'lesson' && (!formData.courseId || !formData.lessonId)) {
      toast.error('Wybierz kurs i lekcję');
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

  // Compute selected course info for preview
  const selectedCourse = useMemo(() => {
    if (!formData.courseId) return null;
    return courses.find(c => c.id === formData.courseId) || null;
  }, [formData.courseId, courses]);

  const selectedLesson = useMemo(() => {
    if (!formData.lessonId) return null;
    return lessons.find(l => l.id === formData.lessonId) || null;
  }, [formData.lessonId, lessons]);

  const recipientCount =
    formData.recipients === 'all'
      ? students.length
      : formData.recipients === 'debtors'
      ? debtorsCount
      : formData.recipients === 'selected'
      ? formData.selectedStudentIds.length
      : formData.recipients === 'course'
      ? selectedCourse?._count?.enrollments || 0
      : 1; // lesson = 1 student

  // Mail type config for preview styling
  const mailTypeConfig: Record<MailType, { color: string; label: string }> = {
    'custom': { color: '#2563eb', label: '' },
    'welcome': { color: '#2563eb', label: '' },
    'reminder': { color: '#d97706', label: '' },
    'payment': { color: '#dc2626', label: '' },
    'teacher-rating': { color: '#7c3aed', label: 'Ocena lektora' },
    'survey': { color: '#0891b2', label: 'Ankieta' },
    'complaint': { color: '#be185d', label: 'Reklamacja' },
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          Mailingi
        </h1>
        <p className="text-gray-600 mt-2">
          Wysyłaj wiadomości do uczniów — powiadomienia, ankiety, prośby o ocenę i więcej
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Templates */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Szablon wiadomości
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => applyTemplate('welcome')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.mailType === 'welcome'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-medium">Powitalna</span>
              </div>
              <p className="text-sm text-gray-600">
                Dla nowych uczniów
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('reminder')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.mailType === 'reminder'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-amber-600" />
                <span className="font-medium">Przypomnienie</span>
              </div>
              <p className="text-sm text-gray-600">
                O zajęciach
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('payment')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.mailType === 'payment'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-medium">Płatności</span>
              </div>
              <p className="text-sm text-gray-600">
                Zaległe płatności
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('teacher-rating')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.mailType === 'teacher-rating'
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-purple-600" />
                <span className="font-medium">Oceń lektora</span>
              </div>
              <p className="text-sm text-gray-600">
                Prośba o ocenę
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('survey')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.mailType === 'survey'
                  ? 'border-cyan-500 bg-cyan-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-5 w-5 text-cyan-600" />
                <span className="font-medium">Ankieta</span>
              </div>
              <p className="text-sm text-gray-600">
                Ankieta satysfakcji
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('complaint')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.mailType === 'complaint'
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquareWarning className="h-5 w-5 text-pink-600" />
                <span className="font-medium">Reklamacja</span>
              </div>
              <p className="text-sm text-gray-600">
                Odpowiedź na reklamację
              </p>
            </button>

            <button
              type="button"
              onClick={() => applyTemplate('custom')}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                formData.mailType === 'custom'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Niestandardowa</span>
              </div>
              <p className="text-sm text-gray-600">
                Własna wiadomość
              </p>
            </button>
          </div>
        </div>

        {/* Email Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Treść wiadomości
            </h2>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showPreview
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="h-4 w-4" />
              Podgląd
            </button>
          </div>

          {showPreview ? (
            /* Email Preview */
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div className="bg-white rounded-lg shadow-sm p-6 max-w-[600px] mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
                {mailTypeConfig[formData.mailType].label && (
                  <span
                    className="inline-block text-white text-xs px-3 py-1 rounded-full mb-3"
                    style={{ backgroundColor: mailTypeConfig[formData.mailType].color }}
                  >
                    {mailTypeConfig[formData.mailType].label}
                  </span>
                )}
                <h2
                  className="text-xl font-bold mb-4"
                  style={{ color: mailTypeConfig[formData.mailType].color }}
                >
                  {formData.subject || '(Brak tematu)'}
                </h2>
                {selectedCourse && (
                  <div className="bg-gray-100 rounded-lg px-4 py-3 mb-4">
                    <p className="text-sm text-gray-500">
                      <strong>Kurs:</strong> {selectedCourse.name}
                      {selectedCourse.teacher && (
                        <> &nbsp;|&nbsp; <strong>Lektor:</strong> {selectedCourse.teacher.user.firstName} {selectedCourse.teacher.user.lastName}</>
                      )}
                      {selectedLesson && (
                        <> &nbsp;|&nbsp; <strong>Lekcja:</strong> {selectedLesson.title}</>
                      )}
                    </p>
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed text-gray-800">
                  {formData.message || '(Brak treści)'}
                </div>
                {formData.attachments.length > 0 && (
                  <p className="text-sm text-gray-500 mt-5">
                    Załączniki: {formData.attachments.map(a => a.name).join(', ')}
                  </p>
                )}
                <hr className="my-6 border-gray-200" />
                <p className="text-sm text-gray-400">
                  Ta wiadomość została wysłana z systemu zarządzania szkołą językową.
                </p>
              </div>
            </div>
          ) : (
            /* Email Form */
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
          )}
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
                  onChange={() =>
                    setFormData({ ...formData, recipients: 'all' })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Wszyscy uczniowie ({students.length})
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="debtors"
                  checked={formData.recipients === 'debtors'}
                  onChange={() =>
                    setFormData({ ...formData, recipients: 'debtors' })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-gray-700">
                  Dłużnicy ({debtorsCount})
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="course"
                  checked={formData.recipients === 'course'}
                  onChange={() =>
                    setFormData({ ...formData, recipients: 'course', lessonId: '' })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">
                  Uczniowie kursu
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="lesson"
                  checked={formData.recipients === 'lesson'}
                  onChange={() =>
                    setFormData({ ...formData, recipients: 'lesson' })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <GraduationCap className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">
                  Uczeń z lekcji
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="selected"
                  checked={formData.recipients === 'selected'}
                  onChange={() =>
                    setFormData({ ...formData, recipients: 'selected' })
                  }
                  className="w-4 h-4 text-primary focus:ring-primary"
                />
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Wybrani uczniowie
                </span>
              </label>
            </div>

            {/* Course selection */}
            {(formData.recipients === 'course' || formData.recipients === 'lesson') && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kurs
                  </label>
                  <SearchableSelect
                    value={formData.courseId}
                    onChange={(val) =>
                      setFormData({ ...formData, courseId: val, lessonId: '' })
                    }
                    options={courses.map((course) => ({
                      value: course.id,
                      label: `${course.name} (${course.language} ${course.level}) — ${course.teacher.user.firstName} ${course.teacher.user.lastName}`,
                    }))}
                    placeholder="Wybierz kurs..."
                  />
                </div>

                {/* Lesson selection (only for lesson recipient type) */}
                {formData.recipients === 'lesson' && formData.courseId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lekcja
                    </label>
                    <SearchableSelect
                      value={formData.lessonId}
                      onChange={(val) =>
                        setFormData({ ...formData, lessonId: val })
                      }
                      options={lessons.map((lesson) => ({
                        value: lesson.id,
                        label: `${lesson.title} — ${new Date(lesson.scheduledAt).toLocaleString('pl-PL')} (${lesson.student.user.firstName} ${lesson.student.user.lastName})`,
                      }))}
                      placeholder="Wybierz lekcję..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Student selection */}
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

        {/* Scheduled Sending */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            Zaplanuj wysyłkę
          </h2>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Pozostaw puste, aby wysłać natychmiast
            </p>
            <input
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) =>
                setFormData({ ...formData, scheduledAt: e.target.value })
              }
              min={new Date().toISOString().slice(0, 16)}
              className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {formData.scheduledAt && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-primary font-medium">
                  Zaplanowano na: {new Date(formData.scheduledAt).toLocaleString('pl-PL')}
                </span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, scheduledAt: '' })}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Wyczyść
                </button>
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
                  {formData.scheduledAt ? 'Planowanie...' : 'Wysyłanie...'}
                </>
              ) : (
                <>
                  {formData.scheduledAt ? (
                    <>
                      <Calendar className="h-5 w-5" />
                      Zaplanuj wysyłkę
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Wyślij wiadomości
                    </>
                  )}
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
