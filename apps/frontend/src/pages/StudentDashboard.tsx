import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { lessonService } from '../services/lessonService';
import { studentService } from '../services/studentService';
import { BookOpen, Calendar, Clock, TrendingUp, MessageSquare } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const StudentDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  // Fetch student data (uses /me endpoint to look up by userId)
  const { data: studentData, isLoading: isLoadingStudent } = useQuery({
    queryKey: ['currentStudent', user?.id],
    queryFn: () => studentService.getMe(),
    enabled: !!user?.id,
  });

  // Fetch student's lessons using the student record ID
  const { data: lessons = [], isLoading: isLoadingLessons } = useQuery({
    queryKey: ['studentLessons', studentData?.id],
    queryFn: () => lessonService.getLessons({
      studentId: studentData?.id,
    }),
    enabled: !!studentData?.id,
  });

  if (isLoadingStudent || isLoadingLessons) {
    return <LoadingSpinner message="Ładowanie danych..." />;
  }

  const upcomingLessons = lessons.filter(
    (lesson: any) => new Date(lesson.scheduledAt) > new Date() && lesson.status === 'SCHEDULED'
  ).slice(0, 5);

  const completedLessonsCount = lessons.filter((lesson: any) => lesson.status === 'COMPLETED').length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Witaj, {user?.firstName}! 👋
        </h1>
        <p className="mt-2 text-gray-600">
          Kontynuuj swoją naukę języka
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Moje kursy</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {studentData?.enrollments?.length || 0}
              </p>
            </div>
            <div className="bg-secondary p-3 rounded-lg">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Nadchodzące lekcje</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {upcomingLessons.length}
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
              <p className="text-sm font-medium text-gray-600">Ukończone lekcje</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {completedLessonsCount}
              </p>
            </div>
            <div className="bg-green-500 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

      </div>

      {/* Upcoming Lessons */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Nadchodzące lekcje
        </h2>
        {upcomingLessons.length > 0 ? (
          <div className="space-y-3">
            {upcomingLessons.map((lesson: any) => (
              <div
                key={lesson.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center bg-primary text-white rounded-lg p-3">
                    <span className="text-xs font-medium">
                      {format(new Date(lesson.scheduledAt), 'MMM', { locale: pl })}
                    </span>
                    <span className="text-xl font-bold">
                      {format(new Date(lesson.scheduledAt), 'dd', { locale: pl })}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lesson.title}</p>
                    <p className="text-xs text-gray-600">
                      {lesson.teacher?.user?.firstName} {lesson.teacher?.user?.lastName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {format(new Date(lesson.scheduledAt), 'HH:mm', { locale: pl })}
                        {' '}({lesson.durationMinutes} min)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Brak nadchodzących lekcji
          </p>
        )}
      </div>

      {/* Active Courses */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Moje kursy
        </h2>
        {studentData?.enrollments && studentData.enrollments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentData.enrollments
              .filter((e: any) => e.status === 'ACTIVE')
              .map((enrollment: any) => (
                <div
                  key={enrollment.id}
                  className="p-4 bg-gradient-to-r from-secondary/10 to-primary/10 rounded-lg border border-secondary/20"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {enrollment.course?.name}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Godziny: {parseFloat(enrollment.hoursUsed || 0).toFixed(1)} / {parseFloat(enrollment.hoursPurchased || 0).toFixed(1)}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-secondary h-2 rounded-full"
                        style={{
                          width: `${Math.min(
                            (parseFloat(enrollment.hoursUsed || 0) / parseFloat(enrollment.hoursPurchased || 1)) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Nie jesteś zapisany na żaden kurs
          </p>
        )}
      </div>
      {/* Notatki od szkoły */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-secondary" />
          <h2 className="text-xl font-semibold text-gray-900">Notatki od szkoły</h2>
        </div>
        {studentData?.internalNotes ? (
          <p className="text-gray-700 whitespace-pre-wrap">{studentData.internalNotes}</p>
        ) : (
          <p className="text-gray-500 text-center py-4">Brak notatek od szkoły</p>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
