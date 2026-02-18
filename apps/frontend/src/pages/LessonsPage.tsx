import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { lessonService, Lesson, LessonStatus } from '../services/lessonService';
import { courseService } from '../services/courseService';
import { googleCalendarService, ExternalCalendarEvent } from '../services/googleCalendarService';
import substitutionService from '../services/substitutionService';
import LessonModal from '../components/LessonModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Dropdown from '../components/Dropdown';
import SubstitutionsTab from '../components/SubstitutionsTab';
import {
  Calendar as CalendarIcon,
  List as ListIcon,
  Clock,
  User,
  GraduationCap,
  Video,
  MapPin,
  Search,
  CheckCircle,
  AlertCircle,
  XCircle,
  MoreVertical,
  RefreshCw,
  Users,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, momentLocalizer, View, SlotInfo } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/pl';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// Set Polish locale
moment.locale('pl');
moment.updateLocale('pl', {
  week: {
    dow: 1
  },
});
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

// Calendar event type
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Lesson | ExternalCalendarEvent;
  isExternal?: boolean;
}

// View mode type
type ViewMode = 'list' | 'calendar' | 'substitutions';

// Map lesson status to colors
const getEventStyle = (event: CalendarEvent) => {
  const baseStyle = {
    borderRadius: '8px',
    border: 'none',
    display: 'block',
    padding: '4px 8px',
    fontSize: '0.875rem',
    fontWeight: '500',
  };

  // External events have a different style
  if (event.isExternal) {
    return { ...baseStyle, backgroundColor: '#8B5CF6', color: 'white', opacity: 0.8 };
  }

  const lesson = event.resource as Lesson;
  switch (lesson.status) {
    case 'SCHEDULED':
      return { ...baseStyle, backgroundColor: '#3B82F6', color: 'white' };
    case 'CONFIRMED':
      return { ...baseStyle, backgroundColor: '#10B981', color: 'white' };
    case 'COMPLETED':
      return { ...baseStyle, backgroundColor: '#6B7280', color: 'white' };
    case 'CANCELLED':
      return { ...baseStyle, backgroundColor: '#EF4444', color: 'white' };
    case 'PENDING_CONFIRMATION':
      return { ...baseStyle, backgroundColor: '#F59E0B', color: 'white' };
    case 'NO_SHOW':
      return { ...baseStyle, backgroundColor: '#DC2626', color: 'white' };
    default:
      return { ...baseStyle, backgroundColor: '#6B7280', color: 'white' };
  }
};

const LessonsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setSearchParams(prev => {
      prev.set('view', mode);
      return prev;
    });
  };

  // Shared filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LessonStatus | ''>('');
  const [courseFilter, setCourseFilter] = useState<string>('');

  // Initialize courseFilter from URL params
  useEffect(() => {
    const courseId = searchParams.get('courseId');
    const mode = searchParams.get('view') as ViewMode | null;

    if (courseId) {
      setCourseFilter(courseId);
    }

    // Jeśli w URL jest parametr view, ustawiamy stan widoku
    if (mode === 'calendar' || mode === 'list' || mode === 'substitutions') {
      setViewMode(mode);
    }
  }, [searchParams]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  // Bulk selection state
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [bulkStatusTarget, setBulkStatusTarget] = useState<LessonStatus | ''>('');

  // List view states
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; lessonId: string | null }>({ isOpen: false, lessonId: null });
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; lessonId: string | null }>({ isOpen: false, lessonId: null });
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Calendar view states
  const [calendarView, setCalendarView] = useState<View>('week');
  const [date, setDate] = useState(new Date());
  const [isDragging, setIsDragging] = useState(false);

  // Fetch courses for dropdown
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses({ isActive: true }),
  });

  // Shared data source - single query for both views
  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons', searchTerm, statusFilter, courseFilter],
    queryFn: () =>
      lessonService.getLessons({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        courseId: courseFilter || undefined,
      }),
  });

  // Fetch substitutions
  const { data: substitutions = [] } = useQuery({
    queryKey: ['substitutions'],
    queryFn: () => substitutionService.getSubstitutions(),
  });

  // Create a map of lesson ID to substitution for quick lookup
  const substitutionMap = useMemo(() => {
    const map = new Map();
    substitutions.forEach(sub => {
      map.set(sub.lessonId, sub);
    });
    return map;
  }, [substitutions]);

  // Fetch external calendar events
  const { data: externalEvents = [] } = useQuery({
    queryKey: ['externalEvents'],
    queryFn: () => googleCalendarService.getExternalEvents(),
    // Only fetch if calendar view is active
    enabled: viewMode === 'calendar',
  });

  // Shared mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => lessonService.deleteLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      toast.success('Lekcja została pomyślnie usunięta');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania lekcji');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => lessonService.confirmLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      toast.success('Lekcja została potwierdzona');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd potwierdzania lekcji');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (lessonId: string) =>
      lessonService.updateLesson(lessonId, { status: 'COMPLETED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      toast.success('Lekcja oznaczona jako zakończona');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd przy oznaczaniu lekcji jako zakończonej');
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: (lessonId: string) =>
      lessonService.updateLesson(lessonId, { status: 'CONFIRMED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      toast.success('Potwierdzenie lekcji zostało cofnięte');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd przy cofaniu potwierdzenia');
    },
  });

  const updateLessonMutation = useMutation({
    mutationFn: ({ id, scheduledAt, durationMinutes }: { id: string; scheduledAt: string; durationMinutes: number }) =>
      lessonService.updateLesson(id, { scheduledAt, durationMinutes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setIsDragging(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Nie można przenieść lekcji');
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setIsDragging(false);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => googleCalendarService.syncFromGoogleCalendar(),
    onSuccess: (data) => {
      const lessonsResult = data?.lessonsSynced;
      const externalResult = data?.externalEventsImported;

      let message = 'Synchronizacja zakończona pomyślnie!';
      if (lessonsResult && externalResult) {
        message += `\nLekcje: ${lessonsResult.synced}/${lessonsResult.total}\nOsobiste wydarzenia: ${externalResult.imported}/${externalResult.total}`;
      }

      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['externalEvents'] });
    },
    onError: (error) => {
      console.error('Error syncing:', error);
      toast.error('Błąd podczas synchronizacji');
    },
  });



  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ lessonIds, status }: { lessonIds: string[]; status: LessonStatus }) =>
      lessonService.bulkUpdateStatus(lessonIds, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setSelectedLessonIds(new Set());
      setBulkStatusTarget('');
      if (data.failed === 0) {
        toast.success(`Zaktualizowano ${data.updated} lekcji`);
      } else {
        toast.success(`Zaktualizowano ${data.updated} lekcji, ${data.failed} błędów`);
        if (data.errors.length > 0) {
          data.errors.forEach((e) => toast.error(`${e.title}: ${e.error}`));
        }
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Błąd podczas masowej aktualizacji statusów');
    },
  });

  // Bulk selection handlers
  const handleToggleLesson = (lessonId: string) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedLessonIds.size === lessons.length) {
      setSelectedLessonIds(new Set());
    } else {
      setSelectedLessonIds(new Set(lessons.map((l) => l.id)));
    }
  };

  const handleBulkStatusChange = () => {
    if (!bulkStatusTarget || selectedLessonIds.size === 0) return;
    bulkUpdateMutation.mutate({
      lessonIds: Array.from(selectedLessonIds),
      status: bulkStatusTarget,
    });
  };

  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setSelectedSlot(null);
    setIsModalOpen(true);
  };

  const handleDeleteLesson = (id: string) => {
    setDeleteDialog({ isOpen: true, lessonId: id });
  };

  const confirmDeleteLesson = async () => {
    if (deleteDialog.lessonId) {
      await deleteMutation.mutateAsync(deleteDialog.lessonId);
    }
  };

  const handleConfirmLesson = (id: string) => {
    setConfirmDialog({ isOpen: true, lessonId: id });
  };

  const confirmLessonStatus = async () => {
    if (confirmDialog.lessonId) {
      await confirmMutation.mutateAsync(confirmDialog.lessonId);
    }
  };

  const handleCompleteLesson = (lessonId: string) => {
    completeMutation.mutate(lessonId);
  };

  const handleUncompleteLesson = (lessonId: string) => {
    uncompleteMutation.mutate(lessonId);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedLesson(null);
    setSelectedSlot(null);
  };

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
    handleModalClose();
  };

  // Calendar-specific handlers
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setSelectedSlot({ start: slotInfo.start, end: slotInfo.end });
    setSelectedLesson(null);
    setIsModalOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    // Don't open modal for external events
    if (event.isExternal) {
      const externalEvent = event.resource as ExternalCalendarEvent;
      toast(
        (_) => (
          <span>
            <b>{externalEvent.title}</b>
            {externalEvent.description && (
              <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                {externalEvent.description}
              </p>
            )}
          </span>
        ),
        {
          icon: 'ℹ️',
        }
      );
      return;
    }

    setSelectedLesson(event.resource as Lesson);
    setSelectedSlot(null);
    setIsModalOpen(true);
  }, []);

  const handleEventDrop = useCallback(
    async ({ event, start, end }: any) => {
      // Don't allow dragging external events
      if (event.isExternal) {
        setIsDragging(false);
        return;
      }

      setIsDragging(true);
      const lesson: Lesson = event.resource;
      const newDuration = Math.round((end.getTime() - start.getTime()) / 60000);

      try {
        const conflicts = await lessonService.checkConflicts(
          lesson.teacherId,
          lesson.studentId,
          start.toISOString(),
          newDuration,
          lesson.id
        );

        if (conflicts.hasConflicts) {
          const conflictMessages = [];
          if (conflicts.teacherConflicts.length > 0) {
            conflictMessages.push(`Lektor jest zajęty w tym terminie`);
          }
          if (conflicts.studentConflicts.length > 0) {
            conflictMessages.push(`Uczeń jest zajęty w tym terminie`);
          }
          toast.error(`Nie można przenieść lekcji: ${conflictMessages.join(', ')}`);
          setIsDragging(false);
          return;
        }

        await updateLessonMutation.mutateAsync({
          id: lesson.id,
          scheduledAt: start.toISOString(),
          durationMinutes: newDuration,
        });
      } catch (error) {
        console.error('Error checking conflicts:', error);
        setIsDragging(false);
      }
    },
    [updateLessonMutation]
  );

  const handleEventResize = useCallback(() => {
    // Disable resizing
    return;
  }, []);

  // Convert lessons to calendar events
  const events = useMemo<CalendarEvent[]>(() => {
    const lessonEvents: CalendarEvent[] = lessons.map((lesson) => ({
      id: lesson.id,
      title: `${lesson.student.user.firstName} ${lesson.student.user.lastName} - ${lesson.title}`,
      start: new Date(lesson.scheduledAt),
      end: new Date(new Date(lesson.scheduledAt).getTime() + lesson.durationMinutes * 60000),
      resource: lesson,
      isExternal: false,
    }));

    const externalEventsFormatted: CalendarEvent[] = externalEvents.map((event) => ({
      id: event.id,
      title: `📅 ${event.title}`,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      resource: event,
      isExternal: true,
    }));

    return [...lessonEvents, ...externalEventsFormatted];
  }, [lessons, externalEvents]);

  // Helper functions
  const getStatusBadge = (status: LessonStatus) => {
    const badges: Record<LessonStatus, { text: string; className: string; icon: any }> = {
      SCHEDULED: {
        text: 'Zaplanowana',
        className: 'bg-blue-100 text-blue-800',
        icon: CalendarIcon,
      },
      CONFIRMED: {
        text: 'Potwierdzona',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle,
      },
      COMPLETED: {
        text: 'Zakończona',
        className: 'bg-gray-100 text-gray-800',
        icon: CheckCircle,
      },
      CANCELLED: {
        text: 'Anulowana',
        className: 'bg-red-100 text-red-800',
        icon: XCircle,
      },
      PENDING_CONFIRMATION: {
        text: 'Oczekuje potwierdzenia',
        className: 'bg-yellow-100 text-yellow-800',
        icon: AlertCircle,
      },
      NO_SHOW: {
        text: 'Nieobecność',
        className: 'bg-orange-100 text-orange-800',
        icon: XCircle,
      },
    };

    const badge = badges[status];
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="h-3 w-3" />
        {badge.text}
      </span>
    );
  };

  const getDeliveryModeIcon = (mode: string) => {
    if (mode === 'ONLINE') {
      return <Video className="h-4 w-4 text-blue-500" />;
    }
    return <MapPin className="h-4 w-4 text-green-500" />;
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm', { locale: pl });
    } catch {
      return dateString;
    }
  };

  // Render lesson row
  const renderLessonRow = (lesson: Lesson) => {
    const isSelected = selectedLessonIds.has(lesson.id);
    return (
      <div key={lesson.id} className={`border-b border-gray-200 ${isSelected ? 'bg-primary/5' : ''}`}>
        <div className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center">
          <div className="w-10 flex-shrink-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggleLesson(lesson.id)}
              className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
            />
          </div>
          <div className="flex-1 grid grid-cols-6 gap-4 items-center">
            <div>
              <div className="text-sm font-medium text-gray-900">{lesson.title}</div>
              {lesson.course && (
                <div className="text-xs text-gray-500">{lesson.course.name}</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-gray-400" />
              <div className="text-sm text-gray-900">
                {lesson.teacher.user.firstName} {lesson.teacher.user.lastName}
                {substitutionMap.has(lesson.id) && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    Zastępstwo
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <div className="text-sm text-gray-900">
                {lesson.student.user.firstName} {lesson.student.user.lastName}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <div className="text-sm text-gray-900">{formatDate(lesson.scheduledAt)}</div>
                <div className="text-xs text-gray-500">{lesson.durationMinutes} min</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getDeliveryModeIcon(lesson.deliveryMode)}
              <span className="text-sm text-gray-900">
                {lesson.deliveryMode === 'ONLINE' ? 'Online' : 'Stacjonarne'}
              </span>
            </div>
            <div className="flex flex-col gap-1 items-start">
              {getStatusBadge(lesson.status)}
              {lesson.cancellationFeeApplied && lesson.cancellationFeeAmount && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Opłata: {lesson.cancellationFeeAmount} {lesson.currency || 'PLN'}
                </span>
              )}
            </div>
          </div>
          <div className="ml-4">
            <button
              ref={(el) => {
                if (el) {
                  dropdownTriggerRefs.current.set(lesson.id, el);
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setOpenDropdownId(openDropdownId === lesson.id ? null : lesson.id);
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Więcej opcji"
            >
              <MoreVertical className="h-4 w-4 text-gray-600" />
            </button>
            <Dropdown
              isOpen={openDropdownId === lesson.id}
              onClose={() => setOpenDropdownId(null)}
              triggerRef={{ current: dropdownTriggerRefs.current.get(lesson.id) || null }}
              items={[
                ...(lesson.status === 'SCHEDULED'
                  ? [
                      {
                        label: 'Potwierdź lekcję',
                        onClick: () => handleConfirmLesson(lesson.id),
                      },
                    ]
                  : []),
                ...((lesson.status === 'SCHEDULED' || lesson.status === 'CONFIRMED')
                  ? [
                      {
                        label: 'Oznacz jako zakończoną',
                        onClick: () => handleCompleteLesson(lesson.id),
                      },
                    ]
                  : []),
                ...(lesson.status === 'COMPLETED'
                  ? [
                      {
                        label: 'Cofnij zakończenie',
                        onClick: () => handleUncompleteLesson(lesson.id),
                      },
                    ]
                  : []),
                {
                  label: 'Edytuj lekcję',
                  onClick: () => handleEditLesson(lesson),
                },
                ...(lesson.status !== 'COMPLETED'
                  ? [
                      {
                        label: 'Usuń lekcję',
                        onClick: () => handleDeleteLesson(lesson.id),
                        variant: 'danger' as const,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </div>
      </div>
    );
  };

  const messages = {
    allDay: 'Cały dzień',
    previous: 'Poprzedni',
    next: 'Następny',
    today: 'Dziś',
    month: 'Miesiąc',
    week: 'Tydzień',
    day: 'Dzień',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Czas',
    event: 'Lekcja',
    noEventsInRange: 'Brak zajęć w tym okresie',
    showMore: (total: number) => `+ ${total} więcej`,
  };

  const formats = {
    dayFormat: (date: Date, culture?: string, localizer?: any) => 
      localizer.format(date, 'DD', culture),

    weekdayFormat: (date: Date, culture?: string, localizer?: any) => 
      localizer.format(date, 'dd', culture),

    monthHeaderFormat: (date: Date, culture?: string, localizer?: any) =>
      localizer.format(date, 'MMMM YYYY', culture),

    dayHeaderFormat: 'dddd, D MMMM',

    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('D MMMM')} – ${moment(end).format('D MMMM YYYY')}`,

    agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('D MMMM')} – ${moment(end).format('D MMMM YYYY')}`,

    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('HH:mm')} – ${moment(end).format('HH:mm')}`,

    timeGutterFormat: 'HH:mm',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grafik</h1>
          <p className="mt-1 text-sm text-gray-500">
            Zarządzaj grafikiem lekcji ({lessons.length} lekcji)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => toggleViewMode('list')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Widok listy"
            >
              <ListIcon className="h-4 w-4" />
              Lista
            </button>
            <button
              onClick={() => toggleViewMode('calendar')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Widok kalendarza"
            >
              <CalendarIcon className="h-4 w-4" />
              Kalendarz
            </button>
            <button
              onClick={() => toggleViewMode('substitutions')}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'substitutions'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Zastępstwa"
            >
              <Users className="h-4 w-4" />
              Zastępstwa
            </button>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'calendar' && (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="flex items-center justify-center p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Synchronizuj z Google Calendar"
              >
                <RefreshCw className={`h-5 w-5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              </button>
            )}
            {/* Przycisk dodawania lekcji ukryty - lekcje dodaje się z poziomu kursów lub kalendarza */}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Szukaj lekcji..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Course Filter */}
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Wszystkie kursy</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LessonStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Wszystkie statusy</option>
            <option value="SCHEDULED">Zaplanowane</option>
            <option value="CONFIRMED">Potwierdzone</option>
            <option value="PENDING_CONFIRMATION">Oczekujące potwierdzenia</option>
            <option value="COMPLETED">Zakończone</option>
            <option value="CANCELLED">Anulowane</option>
            <option value="NO_SHOW">Nieobecność</option>
          </select>
        </div>
      </div>

      {/* Content - List, Calendar, or Substitutions */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-12">
          <LoadingSpinner message="Ładowanie lekcji..." />
        </div>
      ) : viewMode === 'substitutions' ? (
        /* Substitutions View */
        <SubstitutionsTab substitutions={substitutions} />
      ) : viewMode === 'list' ? (
        /* List View with Virtualization */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Bulk action bar */}
          {selectedLessonIds.size > 0 && (
            <div className="px-6 py-3 bg-primary/5 border-b border-primary/20 flex items-center gap-4">
              <span className="text-sm font-medium text-primary">
                <CheckSquare className="h-4 w-4 inline mr-1" />
                Zaznaczono {selectedLessonIds.size} {selectedLessonIds.size === 1 ? 'lekcję' : selectedLessonIds.size < 5 ? 'lekcje' : 'lekcji'}
              </span>
              <select
                value={bulkStatusTarget}
                onChange={(e) => setBulkStatusTarget(e.target.value as LessonStatus | '')}
                className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">Zmień status na...</option>
                <option value="SCHEDULED">Zaplanowana</option>
                <option value="CONFIRMED">Potwierdzona</option>
                <option value="COMPLETED">Zakończona</option>
                <option value="CANCELLED">Anulowana</option>
                <option value="PENDING_CONFIRMATION">Oczekuje potwierdzenia</option>
                <option value="NO_SHOW">Nieobecność</option>
              </select>
              <button
                onClick={handleBulkStatusChange}
                disabled={!bulkStatusTarget || bulkUpdateMutation.isPending}
                className="text-sm px-3 py-1.5 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {bulkUpdateMutation.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aktualizowanie...</>
                ) : (
                  'Zastosuj'
                )}
              </button>
              <button
                onClick={() => setSelectedLessonIds(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700 ml-auto"
              >
                Odznacz wszystko
              </button>
            </div>
          )}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-10 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={lessons.length > 0 && selectedLessonIds.size === lessons.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer"
                  title="Zaznacz wszystko"
                />
              </div>
              <div className="flex-1 grid grid-cols-6 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div>Lekcja</div>
                <div>Lektor</div>
                <div>Uczeń</div>
                <div>Data i czas</div>
                <div>Tryb</div>
                <div>Status</div>
              </div>
              <div className="w-10"></div>
            </div>
          </div>
          {lessons.length === 0 ? (
            <div className="py-12 text-center">
              <div className="flex flex-col items-center justify-center text-gray-500">
                <CalendarIcon className="h-12 w-12 mb-2 text-gray-400" />
                <p className="text-lg font-medium">Brak lekcji</p>
                <p className="text-sm">Dodaj pierwszą lekcję, aby rozpocząć</p>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
              {lessons.map((lesson) => renderLessonRow(lesson))}
            </div>
          )}
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" style={{ height: '700px' }}>
          {isDragging && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-700">Przenoszenie lekcji...</p>
              </div>
            </div>
          )}
          <DnDCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            view={calendarView}
            onView={setCalendarView}
            date={date}
            onNavigate={setDate}
            selectable
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            resizable={false}
            draggableAccessor={(event: CalendarEvent) => !event.isExternal && calendarView !== 'month'}
            messages={messages}
            formats={formats}
            eventPropGetter={(event: CalendarEvent) => ({
              style: getEventStyle(event),
            })}
            step={15}
            timeslots={4}
            defaultView="week"
            views={['month', 'week', 'day', 'agenda']}
            showMultiDayTimes
            culture="pl"
          />
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <LessonModal
          lesson={selectedLesson}
          initialDate={selectedSlot?.start}
          initialDuration={selectedSlot ? Math.round((selectedSlot.end.getTime() - selectedSlot.start.getTime()) / 60000) : 60}
          initialCourseId={courseFilter || undefined}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Delete Lesson Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, lessonId: null })}
        onConfirm={confirmDeleteLesson}
        title="Usuń lekcję"
        message="Czy na pewno chcesz usunąć tę lekcję? Ta operacja jest nieodwracalna."
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* Confirm Lesson Status Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, lessonId: null })}
        onConfirm={confirmLessonStatus}
        title="Potwierdź lekcję"
        message="Czy na pewno chcesz potwierdzić tę lekcję?"
        confirmText="Potwierdź"
        cancelText="Anuluj"
        variant="info"
      />

      <style>{`
        .rbc-calendar {
          font-family: inherit;
        }
        .rbc-event {
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .rbc-month-view {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          min-height: 500px;
        }
        .rbc-month-row {
          min-height: 80px;
        }
        .rbc-month-view .rbc-header {
          padding: 12px 4px;
          font-weight: 600;
          color: #374151;
          background-color: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }
        .rbc-month-view .rbc-day-bg {
          border-left: 1px solid #e5e7eb;
        }
        .rbc-month-view .rbc-day-bg:first-child {
          border-left: none;
        }
        .rbc-month-view .rbc-date-cell {
          padding: 8px;
          text-align: right;
        }
        .rbc-month-view .rbc-off-range-bg {
          background-color: #f9fafb;
        }
        .rbc-month-view .rbc-today {
          background-color: #fef3c7;
        }
        .rbc-month-view .rbc-event {
          padding: 2px 6px;
          margin: 1px 2px;
          font-size: 0.75rem;
          border-radius: 4px;
        }
        .rbc-show-more {
          color: #2563eb;
          font-weight: 500;
          margin: 2px 4px;
          font-size: 0.75rem;
        }
        .rbc-event:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .rbc-today {
          background-color: #FEF3C7;
        }
        .rbc-header {
          padding: 12px 4px;
          font-weight: 600;
          border-bottom: 2px solid #E5E7EB;
        }
        .rbc-time-slot {
          border-top: 1px solid #F3F4F6;
        }
        .rbc-timeslot-group {
          border-left: 1px solid #E5E7EB;
        }
        .rbc-current-time-indicator {
          background-color: #EF4444;
          height: 2px;
        }
        .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid #F3F4F6;
        }
      `}</style>
    </div>
  );
};

export default LessonsPage;
