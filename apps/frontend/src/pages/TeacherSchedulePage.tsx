import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, View } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/pl';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useQuery } from '@tanstack/react-query';
import teacherScheduleService from '../services/teacherScheduleService';
import { Lesson } from '../services/lessonService';
import LessonModal from '../components/LessonModal';
import LoadingSpinner from '../components/LoadingSpinner';
import { Calendar as CalendarIcon, Clock, Users, BookOpen } from 'lucide-react';

// Set Polish locale
moment.locale('pl');
const localizer = momentLocalizer(moment);

// Calendar event type
interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Lesson;
}

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

const TeacherSchedulePage: React.FC = () => {
  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Calculate date range for the current view
  const dateRange = useMemo(() => {
    const start = moment(date).startOf(view === 'month' ? 'month' : 'week').toISOString();
    const end = moment(date).endOf(view === 'month' ? 'month' : 'week').toISOString();
    return { startDate: start, endDate: end };
  }, [date, view]);

  // Fetch teacher's schedule
  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['teacher-schedule', dateRange],
    queryFn: () => teacherScheduleService.getMySchedule(dateRange),
  });

  // Convert lessons to calendar events
  const events = useMemo<CalendarEvent[]>(() => {
    return lessons.map((lesson: Lesson) => ({
      id: lesson.id,
      title: `${lesson.student.user.firstName} ${lesson.student.user.lastName} - ${lesson.title}`,
      start: new Date(lesson.scheduledAt),
      end: new Date(new Date(lesson.scheduledAt).getTime() + lesson.durationMinutes * 60000),
      resource: lesson,
    }));
  }, [lessons]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalHours = lessons.reduce((acc: number, lesson: Lesson) => acc + lesson.durationMinutes / 60, 0);
    const uniqueStudents = new Set(lessons.map((lesson: Lesson) => lesson.student.id)).size;
    const completedLessons = lessons.filter((lesson: Lesson) => lesson.status === 'COMPLETED').length;

    return {
      totalLessons: lessons.length,
      totalHours: totalHours.toFixed(1),
      uniqueStudents,
      completedLessons,
    };
  }, [lessons]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedLesson(event.resource);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLesson(null);
  };

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    return {
      style: getEventStyle(event.resource),
    };
  }, []);

  const messages = {
    today: 'Dzisiaj',
    previous: 'Wstecz',
    next: 'Dalej',
    month: 'Miesiąc',
    week: 'Tydzień',
    day: 'Dzień',
    agenda: 'Agenda',
    date: 'Data',
    time: 'Czas',
    event: 'Lekcja',
    noEventsInRange: 'Brak lekcji w tym okresie',
    showMore: (total: number) => `+ ${total} więcej`,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mój grafik</h1>
        <p className="mt-2 text-gray-600">
          Przeglądaj swoje zaplanowane lekcje i zarządzaj grafikiem
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Wszystkie lekcje</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalLessons}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Godziny</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalHours}h</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Uczniowie</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.uniqueStudents}</p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Zrealizowane</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completedLessons}</p>
            </div>
            <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        {isLoading ? (
          <LoadingSpinner message="Ładowanie grafiku..." />
        ) : (
          <div style={{ height: '600px' }}>
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              onSelectEvent={handleSelectEvent}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              eventPropGetter={eventStyleGetter}
              messages={messages}
              style={{ height: '100%' }}
              popup
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Legenda statusów</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: '#3B82F6' }}></div>
            <span className="text-sm text-gray-700">Zaplanowana</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: '#10B981' }}></div>
            <span className="text-sm text-gray-700">Potwierdzona</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
            <span className="text-sm text-gray-700">Oczekuje na potwierdzenie</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: '#6B7280' }}></div>
            <span className="text-sm text-gray-700">Zakończona</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: '#EF4444' }}></div>
            <span className="text-sm text-gray-700">Anulowana</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded" style={{ backgroundColor: '#DC2626' }}></div>
            <span className="text-sm text-gray-700">Nieobecność</span>
          </div>
        </div>
      </div>

      {/* Lesson Modal */}
      {isModalOpen && selectedLesson && (
        <LessonModal lesson={selectedLesson} onClose={handleCloseModal} onSuccess={() => {}}/>
      )}
    </div>
  );
};

export default TeacherSchedulePage;
