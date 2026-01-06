import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { dashboardService } from '../services/dashboardService';
import { lessonService } from '../services/lessonService';
import { Calendar, Clock, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const TeacherDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  // Fetch teacher reminders
  const { data: reminders } = useQuery({
    queryKey: ['teacherReminders'],
    queryFn: () => dashboardService.getReminders(),
    refetchInterval: 60000,
  });

  // Fetch today's lessons
  const { data: todayLessons = [], isLoading } = useQuery({
    queryKey: ['todayLessons'],
    queryFn: () => lessonService.getLessons({
      teacherId: user?.id,
      // You might want to add date filter for today
    }),
  });

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie danych..." />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Witaj, {user?.firstName}! 👋
        </h1>
        <p className="mt-2 text-gray-600">
          Oto Twój harmonogram i przypomnienia
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lekcje dzisiaj</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {todayLessons.length}
              </p>
            </div>
            <div className="bg-primary p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Przypomnienia</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {reminders?.incompleteAttendance?.length || 0}
              </p>
            </div>
            <div className="bg-yellow-500 p-3 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aktywni uczniowie</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {new Set(todayLessons.map(l => l.studentId)).size}
              </p>
            </div>
            <div className="bg-secondary p-3 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Reminders */}
      {reminders?.incompleteAttendance && reminders.incompleteAttendance.length > 0 && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <h3 className="text-lg font-semibold text-yellow-900">
              Przypomnienia ({reminders.incompleteAttendance.length})
            </h3>
          </div>
          <div className="space-y-3">
            {reminders.incompleteAttendance.map((reminder) => (
              <div
                key={reminder.id}
                className="bg-white border border-yellow-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {reminder.studentName}
                    </p>
                    <p className="text-xs text-gray-600">
                      Kurs: {reminder.courseName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-yellow-700 font-medium">
                      {reminder.message}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(reminder.scheduledAt), 'dd MMM yyyy', { locale: pl })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Lessons */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Dzisiejsze lekcje
        </h2>
        {todayLessons.length > 0 ? (
          <div className="space-y-3">
            {todayLessons.slice(0, 5).map((lesson: any) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">
                      {format(new Date(lesson.scheduledAt), 'HH:mm', { locale: pl })}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {lesson.student?.user?.firstName} {lesson.student?.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-600">{lesson.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lesson.status === 'COMPLETED' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  <span className={`text-xs px-2 py-1 rounded ${
                    lesson.status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : lesson.status === 'SCHEDULED'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {lesson.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Brak zaplanowanych lekcji na dziś
          </p>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
