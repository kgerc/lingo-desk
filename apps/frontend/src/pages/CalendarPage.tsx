import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, View, SlotInfo } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/pl';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { lessonService, Lesson } from '../services/lessonService';
import LessonModal from '../components/LessonModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { Plus, Filter } from 'lucide-react';

// Set Polish locale
moment.locale('pl');
const localizer = momentLocalizer(moment);
const DnDCalendar = withDragAndDrop(Calendar);

// Map lesson status to colors
const getEventStyle = (lesson: Lesson) => {
  const baseStyle = {
    borderRadius: '8px',
    border: 'none',
    display: 'block',
    padding: '4px 8px',
    fontSize: '0.875rem',
    fontWeight: '500',
  };

  switch (lesson.status) {
    case 'SCHEDULED':
      return { ...baseStyle, backgroundColor: '#3B82F6', color: 'white' }; // Blue
    case 'CONFIRMED':
      return { ...baseStyle, backgroundColor: '#10B981', color: 'white' }; // Green
    case 'COMPLETED':
      return { ...baseStyle, backgroundColor: '#6B7280', color: 'white' }; // Gray
    case 'CANCELLED':
      return { ...baseStyle, backgroundColor: '#EF4444', color: 'white' }; // Red
    case 'PENDING_CONFIRMATION':
      return { ...baseStyle, backgroundColor: '#F59E0B', color: 'white' }; // Amber
    case 'NO_SHOW':
      return { ...baseStyle, backgroundColor: '#DC2626', color: 'white' }; // Red
    default:
      return { ...baseStyle, backgroundColor: '#6B7280', color: 'white' };
  }
};

const CalendarPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Fetch lessons
  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons', statusFilter],
    queryFn: () =>
      lessonService.getLessons({
        status: statusFilter || undefined,
      }),
  });

  // Update lesson mutation (for drag & drop)
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

  // Convert lessons to calendar events
  const events = useMemo(() => {
    const mappedEvents = lessons.map((lesson) => ({
      id: lesson.id,
      title: `${lesson.student.user.firstName} ${lesson.student.user.lastName} - ${lesson.title}`,
      start: new Date(lesson.scheduledAt),
      end: new Date(new Date(lesson.scheduledAt).getTime() + lesson.durationMinutes * 60000),
      resource: lesson,
    }));
    return mappedEvents;
  }, [lessons]);

  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    setSelectedSlot({ start: slotInfo.start, end: slotInfo.end });
    setSelectedLesson(null);
    setIsModalOpen(true);
  }, []);

  const handleSelectEvent = useCallback((event: any) => {
    setSelectedLesson(event.resource);
    setSelectedSlot(null);
    setIsModalOpen(true);
  }, []);

  // Handle drag and drop - MOVE event (not resize)
  const handleEventDrop = useCallback(
    async ({ event, start, end }: any) => {
      setIsDragging(true);
      const lesson: Lesson = event.resource;
      const newDuration = Math.round((end.getTime() - start.getTime()) / 60000);

      // Check for conflicts before moving
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

        // No conflicts - update the lesson
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

  // Disable resizing - we only want to move
  const handleEventResize = useCallback(() => {
    // Do nothing - we disable resizing
    return;
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLesson(null);
    setSelectedSlot(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
    handleCloseModal();
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
    monthHeaderFormat: 'MMMM YYYY',
    dayHeaderFormat: 'dddd, D MMMM',
    dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('D MMMM')} - ${moment(end).format('D MMMM YYYY')}`,
    agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('D MMMM')} - ${moment(end).format('D MMMM YYYY')}`,
    eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
      `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
    timeGutterFormat: 'HH:mm',
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6 flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grafik zajęć</h1>
          <p className="mt-2 text-gray-600">
            Przeglądaj i planuj zajęcia ({lessons.length} lekcji)
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedSlot({ start: new Date(), end: new Date(Date.now() + 60 * 60000) });
            setSelectedLesson(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Dodaj lekcję
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 mb-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-gray-400" />

          {/* View selector */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'month'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Miesiąc
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'week'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tydzień
            </button>
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'day'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dzień
            </button>
            <button
              onClick={() => setView('agenda')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'agenda'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Agenda
            </button>
          </div>

          <div className="h-6 w-px bg-gray-300"></div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Wszystkie statusy</option>
            <option value="SCHEDULED">Zaplanowane</option>
            <option value="CONFIRMED">Potwierdzone</option>
            <option value="COMPLETED">Zakończone</option>
            <option value="CANCELLED">Anulowane</option>
            <option value="PENDING_CONFIRMATION">Oczekujące</option>
          </select>

          {/* Status legend */}
          <div className="flex-1 flex items-center gap-4 ml-6">
            <span className="text-sm text-gray-600">Legenda:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
              <span className="text-sm">Zaplanowane</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10B981' }}></div>
              <span className="text-sm">Potwierdzone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#6B7280' }}></div>
              <span className="text-sm">Zakończone</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#EF4444' }}></div>
              <span className="text-sm">Anulowane</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar - grows to fill remaining space */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex-1 min-h-0 calendar-container relative">
        {isLoading ? (
          <LoadingSpinner message="Ładowanie kalendarza..." />
        ) : (
          <>
            {isDragging && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 rounded-xl">
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
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              resizable={false}
              draggableAccessor={() => view !== 'month'}
              messages={messages}
              formats={formats}
              eventPropGetter={(event) => ({
                style: getEventStyle(event.resource),
              })}
              step={15}
              timeslots={4}
              defaultView="week"
              views={['month', 'week', 'day', 'agenda']}
              showMultiDayTimes
            />
          </>
        )}
      </div>

      {/* Lesson Modal */}
      {isModalOpen && (
        <LessonModal
          lesson={selectedLesson}
          initialDate={selectedSlot?.start}
          initialDuration={selectedSlot ? Math.round((selectedSlot.end.getTime() - selectedSlot.start.getTime()) / 60000) : 60}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}

      <style>{`
        .calendar-container .rbc-calendar {
          font-family: inherit;
        }
        .calendar-container .rbc-event {
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        /* Month view specific styles */
        .calendar-container .rbc-month-view {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          min-height: 500px;
        }
        .calendar-container .rbc-month-row {
          min-height: 80px;
        }
        .calendar-container .rbc-month-view .rbc-header {
          padding: 12px 4px;
          font-weight: 600;
          color: #374151;
          background-color: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }
        .calendar-container .rbc-month-view .rbc-day-bg {
          border-left: 1px solid #e5e7eb;
        }
        .calendar-container .rbc-month-view .rbc-day-bg:first-child {
          border-left: none;
        }
        .calendar-container .rbc-month-view .rbc-date-cell {
          padding: 8px;
          text-align: right;
        }
        .calendar-container .rbc-month-view .rbc-off-range-bg {
          background-color: #f9fafb;
        }
        .calendar-container .rbc-month-view .rbc-today {
          background-color: #fef3c7;
        }
        .calendar-container .rbc-month-view .rbc-event {
          padding: 2px 6px;
          margin: 1px 2px;
          font-size: 0.75rem;
          border-radius: 4px;
        }
        .calendar-container .rbc-show-more {
          color: #2563eb;
          font-weight: 500;
          margin: 2px 4px;
          font-size: 0.75rem;
        }
        .calendar-container .rbc-event:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .calendar-container .rbc-today {
          background-color: #FEF3C7;
        }
        .calendar-container .rbc-header {
          padding: 12px 4px;
          font-weight: 600;
          border-bottom: 2px solid #E5E7EB;
        }
        .calendar-container .rbc-time-slot {
          border-top: 1px solid #F3F4F6;
        }
        .calendar-container .rbc-timeslot-group {
          border-left: 1px solid #E5E7EB;
        }
        .calendar-container .rbc-current-time-indicator {
          background-color: #EF4444;
          height: 2px;
        }
        .calendar-container .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid #F3F4F6;
        }
      `}</style>
    </div>
  );
};

export default CalendarPage;
