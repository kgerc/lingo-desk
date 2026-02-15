import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import payoutService, {
  TeacherSummary,
  PayoutPreview,
  LessonForDay,
  TeacherPayoutStatus,
  groupLessonsByStudent,
  groupLessonsForDayByStudent,
} from '../services/payoutService';
import {
  Search,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Save,
  Trash2,
  Eye,
  History,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  ChevronLeft,
  ChevronDown,
  User,
  AlertCircle,
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import ConfirmDialog from './ConfirmDialog';

type ViewMode = 'list' | 'payout' | 'history';

export default function TeacherPayoutsTab() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; payoutId: string | null }>({
    isOpen: false,
    payoutId: null,
  });
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [rangeDraft, setRangeDraft] = useState<string | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [expandedLessonsStudents, setExpandedLessonsStudents] = useState<Set<string>>(new Set());
  type CalendarFilter =
    | { type: 'ALL' }
    | { type: 'DAY'; date: string };

  const [calendarFilter, setCalendarFilter] =
    useState<CalendarFilter>({ type: 'ALL' });

  // Fetch teachers summary
  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['payouts-teachers-summary'],
    queryFn: () => payoutService.getTeachersSummary(),
    enabled: viewMode === 'list',
  });

  // Fetch teacher payouts history
  const { data: payouts = [], isLoading: isLoadingPayouts } = useQuery({
    queryKey: ['teacher-payouts', selectedTeacher?.id],
    queryFn: () => payoutService.getTeacherPayouts(selectedTeacher!.id),
    enabled: !!selectedTeacher && viewMode === 'history',
  });

  const lessonsRangeQuery = useQuery({
    queryKey: ['teacher-lessons-range', selectedTeacher?.id, periodStart, periodEnd],
    queryFn: () =>
      payoutService.getLessonsForRange(
        selectedTeacher!.id,
        periodStart,
        periodEnd
      ),
    enabled: false, // manual
  });

  // Set default period dates when entering payout view
  useEffect(() => {
    if (viewMode === 'payout') {
      // Default to current month
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setPeriodStart(formatDate(firstDay));
      setPeriodEnd(formatDate(lastDay));
      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }, [viewMode]);

  // Reset calendar day filter when period range changes
  useEffect(() => {
    setCalendarFilter({ type: 'ALL' });
  }, [periodStart, periodEnd]);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () =>
      payoutService.previewPayout(selectedTeacher!.id, periodStart, periodEnd),
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd podczas generowania podglądu');
    },
  });

  // Create payout mutation
  const createMutation = useMutation({
    mutationFn: () =>
      payoutService.createPayout({
        teacherId: selectedTeacher!.id,
        periodStart,
        periodEnd,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Wypłata została zapisana');
      queryClient.invalidateQueries({ queryKey: ['payouts-teachers-summary'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-payouts'] });
      handleBackToList();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd podczas zapisywania wypłaty');
    },
  });

  // Update payout status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TeacherPayoutStatus }) =>
      payoutService.updatePayoutStatus(id, status),
    onSuccess: () => {
      toast.success('Status wypłaty został zaktualizowany');
      queryClient.invalidateQueries({ queryKey: ['teacher-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payouts-teachers-summary'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd podczas aktualizacji statusu');
    },
  });

  // Delete payout mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => payoutService.deletePayout(id),
    onSuccess: () => {
      toast.success('Wypłata została usunięta');
      queryClient.invalidateQueries({ queryKey: ['payouts-teachers-summary'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-payouts'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd podczas usuwania wypłaty');
    },
  });

  const handleSelectTeacher = (teacher: TeacherSummary) => {
    setSelectedTeacher(teacher);
    setViewMode('payout');
    setPreview(null);
    setNotes('');
    setCalendarFilter({ type: 'ALL' });
    setRangeDraft(null);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedTeacher(null);
    setPreview(null);
    setPeriodStart('');
    setPeriodEnd('');
    setNotes('');
  };

  const handleShowHistory = () => {
    setViewMode('history');
  };

  const handleGeneratePreview = () => {
    if (!periodStart || !periodEnd) {
      toast.error('Wybierz zakres dat');
      return;
    }
    previewMutation.mutate();
    lessonsRangeQuery.refetch();
  };

  const handleSavePayout = () => {
    if (!preview) {
      toast.error('Najpierw wygeneruj podgląd wypłaty');
      return;
    }
    if (preview.qualifiedLessons.length === 0) {
      toast.error('Brak lekcji kwalifikujących się do wypłaty');
      return;
    }
    createMutation.mutate();
  };

  const handleDeletePayout = (id: string) => {
    setConfirmDialog({ isOpen: true, payoutId: id });
  };

  const confirmDelete = () => {
    if (confirmDialog.payoutId) {
      deleteMutation.mutate(confirmDialog.payoutId);
    }
  };

  // Filter teachers
  const filteredTeachers = teachers.filter(
    (teacher) =>
      `${teacher.firstName} ${teacher.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLessons = useMemo(() => {
    const lessons = lessonsRangeQuery.data ?? [];

    if (calendarFilter.type === 'ALL') return lessons;

    if (calendarFilter.type === 'DAY') {
      return lessons.filter(
        l => l.scheduledAt.slice(0, 10) === calendarFilter.date
      );
    }

    return lessons;
  }, [lessonsRangeQuery.data, calendarFilter]);

  // Group preview lessons by student
  const groupedPreviewLessons = useMemo(() => {
    if (!preview) return [];
    return groupLessonsByStudent(preview.qualifiedLessons);
  }, [preview]);

  // Group filtered lessons by student (for lessons list view)
  const groupedFilteredLessons = useMemo(() => {
    return groupLessonsForDayByStudent(filteredLessons);
  }, [filteredLessons]);

  // Toggle student expansion in preview
  const toggleStudentExpansion = (studentName: string) => {
    setExpandedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentName)) {
        next.delete(studentName);
      } else {
        next.add(studentName);
      }
      return next;
    });
  };

  // Toggle student expansion in lessons list
  const toggleLessonsStudentExpansion = (studentName: string) => {
    setExpandedLessonsStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentName)) {
        next.delete(studentName);
      } else {
        next.add(studentName);
      }
      return next;
    });
  };

  // Expand/collapse all students in preview
  const expandAllStudents = () => {
    setExpandedStudents(new Set(groupedPreviewLessons.map((g) => g.studentName)));
  };

  const collapseAllStudents = () => {
    setExpandedStudents(new Set());
  };

  // Expand/collapse all students in lessons list
  const expandAllLessonsStudents = () => {
    setExpandedLessonsStudents(new Set(groupedFilteredLessons.map((g) => g.studentName)));
  };

  const collapseAllLessonsStudents = () => {
    setExpandedLessonsStudents(new Set());
  };

  const formatCurrency = (amount: number, currency = 'PLN') => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const getStatusBadge = (status: TeacherPayoutStatus) => {
    const badges = {
      PENDING: (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Oczekuje
        </span>
      ),
      APPROVED: (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Zatwierdzona
        </span>
      ),
      PAID: (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
          <DollarSign className="w-3 h-3" /> Wypłacona
        </span>
      ),
      CANCELLED: (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1">
          <XCircle className="w-3 h-3" /> Anulowana
        </span>
      ),
    };
    return badges[status] || status;
  };

  const getQualificationReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      COMPLETED: 'Ukończona',
      CONFIRMED: 'Potwierdzona',
      LATE_CANCELLATION: 'Późna anulacja',
    };
    return labels[reason] || reason;
  };

  const getLessonStatusBadge = (lesson: LessonForDay) => {
    if (lesson.payout) {
      if (lesson.payout.status === 'PAID') {
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Wypłacona
          </span>
        );
      }
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
          <Clock className="w-3 h-3" /> W wypłacie
        </span>
      );
    }
    if (lesson.qualifiesForPayout) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Do wypłaty
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
        Nie kwalifikuje się
      </span>
    );
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];

    // Add empty days for padding
    const startDay = firstDay.getDay();
    const paddingStart = startDay === 0 ? 6 : startDay - 1;
    for (let i = paddingStart; i > 0; i--) {
      const prevDate = new Date(year, month, 1 - i);
      days.push(prevDate);
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isInRange = (date: Date) => {
    if (!periodStart || !periodEnd) return false;
    const d = formatDate(date);
    return d >= periodStart && d <= periodEnd;
  };

  const isRangeStart = (date: Date) => {
    if (!periodStart) return false;
    return formatDate(date) === periodStart;
  };

  const isRangeEnd = (date: Date) => {
    if (!periodEnd) return false;
    return formatDate(date) === periodEnd;
  };

  const isDraftStart = (date: Date) => {
    if (!rangeDraft) return false;
    return formatDate(date) === rangeDraft;
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthNames = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
  ];

  const dayNames = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

  // Render teacher list view
  if (viewMode === 'list') {
    return (
      <div>
        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Szukaj lektora..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>
        </div>

        {/* Teachers Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lektor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stawka godzinowa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oczekujące wypłaty
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoadingTeachers ? (
                  <tr>
                    <td colSpan={4}>
                      <LoadingSpinner message="Ładowanie lektorów..." />
                    </td>
                  </tr>
                ) : filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      Brak lektorów do wyświetlenia
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold">
                              {teacher.firstName[0]}
                              {teacher.lastName[0]}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {teacher.firstName} {teacher.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{teacher.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(teacher.hourlyRate)}/h
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {teacher.pendingPayoutsCount > 0 ? (
                          <div>
                            <div className="text-sm font-medium text-yellow-600">
                              {teacher.pendingPayoutsCount} wypłat
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatCurrency(teacher.pendingPayoutsTotal)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Brak</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleSelectTeacher(teacher)}
                          className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium text-sm"
                        >
                          <DollarSign className="w-4 h-4" />
                          Rozlicz
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Render history view
  if (viewMode === 'history') {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('payout')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Historia wypłat: {selectedTeacher?.firstName} {selectedTeacher?.lastName}
              </h2>
              <p className="text-sm text-gray-500">{selectedTeacher?.email}</p>
            </div>
          </div>
        </div>

        {/* Payouts List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {isLoadingPayouts ? (
            <LoadingSpinner message="Ładowanie historii..." />
          ) : payouts.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Brak wypłat dla tego lektora
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {payouts.map((payout) => (
                <div key={payout.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(payout.periodStart).toLocaleDateString('pl-PL')} -{' '}
                          {new Date(payout.periodEnd).toLocaleDateString('pl-PL')}
                        </span>
                        {getStatusBadge(payout.status)}
                        <span className="text-xs text-gray-500">
                          Utworzono: {new Date(payout.createdAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Godziny:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {Number(payout.totalHours).toFixed(2)}h
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Kwota:</span>
                          <span className="ml-2 font-medium text-green-600">
                            {formatCurrency(Number(payout.totalAmount), payout.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Lekcji:</span>
                          <span className="ml-2 font-medium text-gray-900">
                            {payout._count?.lessons || payout.lessons?.length || 0}
                          </span>
                        </div>
                      </div>
                      {payout.paidAt && (
                        <p className="mt-2 text-sm text-gray-500">
                          Wypłacono: {new Date(payout.paidAt).toLocaleDateString('pl-PL')}
                        </p>
                      )}
                      {payout.notes && (
                        <p className="mt-2 text-sm text-gray-600">Notatki: {payout.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {payout.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() =>
                              updateStatusMutation.mutate({ id: payout.id, status: 'APPROVED' })
                            }
                            className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            Zatwierdź
                          </button>
                          <button
                            onClick={() => handleDeletePayout(payout.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Usuń wypłatę"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {payout.status === 'APPROVED' && (
                        <button
                          onClick={() =>
                            updateStatusMutation.mutate({ id: payout.id, status: 'PAID' })
                          }
                          className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Oznacz jako wypłacona
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ isOpen: false, payoutId: null })}
          onConfirm={confirmDelete}
          title="Usuń wypłatę"
          message="Czy na pewno chcesz usunąć tę wypłatę? Lekcje będą ponownie dostępne do rozliczenia."
          confirmText="Usuń"
          cancelText="Anuluj"
          variant="danger"
        />
      </div>
    );
  }

  // Render payout view
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Wypłata: {selectedTeacher?.firstName} {selectedTeacher?.lastName}
            </h2>
            <p className="text-sm text-gray-500">
              Stawka: {formatCurrency(selectedTeacher?.hourlyRate || 0)}/h
            </p>
          </div>
        </div>
        <button
          onClick={handleShowHistory}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <History className="w-5 h-5" />
          Historia wypłat
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Calendar and settings */}
        <div className="lg:col-span-1 space-y-6">
          {/* Mini Calendar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h3 className="text-sm font-semibold text-gray-900">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {dayNames.map((day) => (
                <div key={day} className="py-1 text-gray-500 font-medium">
                  {day}
                </div>
              ))}
              {getDaysInMonth(currentMonth).map((date, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const d = formatDate(date);

                    if (!rangeDraft) {
                      // First click - start range draft
                      setRangeDraft(d);
                    } else {
                      // Second click - finalize range and update period
                      const from = rangeDraft < d ? rangeDraft : d;
                      const to = rangeDraft < d ? d : rangeDraft;
                      setPeriodStart(from);
                      setPeriodEnd(to);
                      setRangeDraft(null);
                    }
                  }}
                  className={`py-1.5 rounded text-sm transition-colors relative
                    ${!isCurrentMonth(date) ? 'text-gray-300' : ''}
                    ${isDraftStart(date) ? 'bg-primary/30 text-primary font-semibold' : ''}
                    ${isRangeStart(date) && isRangeEnd(date) ? 'bg-primary text-white rounded-full' : ''}
                    ${isRangeStart(date) && !isRangeEnd(date) ? 'bg-primary text-white rounded-l-full' : ''}
                    ${isRangeEnd(date) && !isRangeStart(date) ? 'bg-primary text-white rounded-r-full' : ''}
                    ${isInRange(date) && !isRangeStart(date) && !isRangeEnd(date)
                      ? 'bg-primary/20 text-primary'
                      : ''}
                    ${isToday(date) ? 'ring-1 ring-blue-400' : ''}
                    hover:bg-gray-100
                  `}
                >
                  {date.getDate()}
                </button>
              ))}
            </div>
          </div>

          {/* Period Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Zakres wypłaty</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data początkowa
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => {
                      setPeriodStart(e.target.value);
                      if (e.target.value) {
                        const [y, m] = e.target.value.split('-').map(Number);
                        setCurrentMonth(new Date(y, m - 1, 1));
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data końcowa
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notatki (opcjonalnie)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Dodatkowe informacje..."
                />
              </div>
              <button
                onClick={handleGeneratePreview}
                disabled={previewMutation.isPending || !periodStart || !periodEnd}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Eye className="w-5 h-5" />
                {previewMutation.isPending ? 'Generowanie...' : 'Generuj podgląd'}
              </button>
            </div>
          </div>
        </div>

        {/* Right column - Lessons for day and preview */}
        <div className="lg:col-span-2 space-y-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {rangeDraft && (
              <span className="px-3 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Wybierz drugi dzień zakresu
              </span>
            )}

            {periodStart && periodEnd && (
              <span className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Zakres: {periodStart} – {periodEnd}
              </span>
            )}

            {calendarFilter.type === 'DAY' && (
              <span className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Filtr dnia: {calendarFilter.date}
              </span>
            )}

            {(calendarFilter.type !== 'ALL' || rangeDraft) && (
              <button
                onClick={() => {
                  setCalendarFilter({ type: 'ALL' });
                  setRangeDraft(null);
                }}
                className="text-xs text-gray-500 underline"
              >
                Wyczyść filtr
              </button>
            )}
          </div>

          {/* Lessons for selected day - grouped by student */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Lekcje: {filteredLessons.length > 0 && `(${filteredLessons.length}) • ${groupedFilteredLessons.length} uczniów`}
              </h3>
              {groupedFilteredLessons.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={expandAllLessonsStudents}
                    className="text-xs text-primary hover:underline"
                  >
                    Rozwiń wszystko
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={collapseAllLessonsStudents}
                    className="text-xs text-primary hover:underline"
                  >
                    Zwiń wszystko
                  </button>
                </div>
              )}
            </div>
            {lessonsRangeQuery.isFetching ? (
              <LoadingSpinner message="Ładowanie lekcji..." />
            ) : filteredLessons.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                Brak lekcji w wybranym zakresie dat
              </div>
            ) : (
              <div className="divide-y divide-gray-200 max-h-[400px] overflow-y-auto">
                {groupedFilteredLessons.map((group) => {
                  const isExpanded = expandedLessonsStudents.has(group.studentName);
                  return (
                    <div key={group.studentName} className="py-2">
                      {/* Student header row */}
                      <button
                        onClick={() => toggleLessonsStudentExpansion(group.studentName)}
                        className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown
                            className={`w-4 h-4 text-gray-500 transition-transform ${
                              isExpanded ? '' : '-rotate-90'
                            }`}
                          />
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-900">
                              {group.studentName}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                            {group.lessonsCount} {group.lessonsCount === 1 ? 'lekcja' : group.lessonsCount < 5 ? 'lekcje' : 'lekcji'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-500">
                            {group.totalHours.toFixed(2)}h
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(group.totalAmount, group.currency)}
                          </span>
                        </div>
                      </button>

                      {/* Expanded lessons list */}
                      {isExpanded && (
                        <div className="ml-7 mt-2 space-y-1">
                          {group.lessons
                            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                            .map((lesson) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between py-2 px-3 bg-white border border-gray-100 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-900">{lesson.title}</span>
                                    {getLessonStatusBadge(lesson)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {new Date(lesson.scheduledAt).toLocaleDateString('pl-PL')} •{' '}
                                    {new Date(lesson.scheduledAt).toLocaleTimeString('pl-PL', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })} •{' '}
                                    {lesson.durationMinutes} min
                                    {lesson.qualificationReason && (
                                      <> • {getQualificationReasonLabel(lesson.qualificationReason)}</>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatCurrency(lesson.amount, lesson.currency)}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {formatCurrency(lesson.hourlyRate)}/h
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Podsumowanie wypłaty
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600">Lekcji</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {preview.qualifiedLessons.length}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-sm text-purple-600">Godzin</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {preview.totalHours.toFixed(2)}h
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600">Do wypłaty</div>
                    <div className="text-2xl font-bold text-green-700">
                      {formatCurrency(preview.totalAmount, preview.currency)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Qualified lessons grouped by student */}
              {preview.qualifiedLessons.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Lekcje do wypłaty ({preview.qualifiedLessons.length}) • {groupedPreviewLessons.length} uczniów
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={expandAllStudents}
                        className="text-xs text-primary hover:underline"
                      >
                        Rozwiń wszystko
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={collapseAllStudents}
                        className="text-xs text-primary hover:underline"
                      >
                        Zwiń wszystko
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
                    {groupedPreviewLessons.map((group) => {
                      const isExpanded = expandedStudents.has(group.studentName);
                      return (
                        <div key={group.studentName} className="py-2">
                          {/* Student header row */}
                          <button
                            onClick={() => toggleStudentExpansion(group.studentName)}
                            className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <ChevronDown
                                className={`w-4 h-4 text-gray-500 transition-transform ${
                                  isExpanded ? '' : '-rotate-90'
                                }`}
                              />
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {group.studentName}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {group.lessonsCount} {group.lessonsCount === 1 ? 'lekcja' : group.lessonsCount < 5 ? 'lekcje' : 'lekcji'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs text-gray-500">
                                {group.totalHours.toFixed(2)}h
                              </span>
                              <span className="text-sm font-semibold text-green-600">
                                {formatCurrency(group.totalAmount, group.currency)}
                              </span>
                            </div>
                          </button>

                          {/* Expanded lessons list */}
                          {isExpanded && (
                            <div className="ml-7 mt-2 space-y-1">
                              {group.lessons
                                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                                .map((lesson) => (
                                  <div
                                    key={lesson.id}
                                    className="flex items-center justify-between py-2 px-3 bg-white border border-gray-100 rounded-lg"
                                  >
                                    <div>
                                      <div className="text-sm text-gray-900">{lesson.title}</div>
                                      <div className="text-xs text-gray-500">
                                        {new Date(lesson.scheduledAt).toLocaleDateString('pl-PL')} •{' '}
                                        {lesson.durationMinutes} min •{' '}
                                        {getQualificationReasonLabel(lesson.qualificationReason)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-green-600">
                                        {formatCurrency(lesson.amount, lesson.currency)}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {formatCurrency(lesson.hourlyRate)}/h
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {preview.qualifiedLessons.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
                  Brak lekcji kwalifikujących się do wypłaty w wybranym okresie
                </div>
              )}

              {/* Save button */}
              {preview.qualifiedLessons.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSavePayout}
                    disabled={createMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {createMutation.isPending ? 'Zapisywanie...' : 'Zapisz wypłatę'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!preview && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Wygeneruj podgląd wypłaty
              </h3>
              <p className="text-gray-500">
                Wybierz zakres dat i kliknij "Generuj podgląd" aby zobaczyć lekcje do rozliczenia
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
