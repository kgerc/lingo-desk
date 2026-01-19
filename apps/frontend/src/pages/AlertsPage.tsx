import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import alertService, { Alert } from '../services/alertService';
import { Bell, CheckCheck, AlertTriangle, Info, XCircle, CheckCircle, ChevronLeft, ChevronRight, Calendar, User, BookOpen } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

interface LessonDetail {
  id: string;
  title: string;
  scheduledAt: string;
  teacherName: string;
  studentName: string;
}

interface StudentDetail {
  id: string;
  name: string;
}

const AlertsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterRead, setFilterRead] = useState<boolean | undefined>(undefined);
  const limit = 20;

  // Fetch alerts (with auto-generation)
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts', page],
    queryFn: async () => {
      await alertService.generateSystemAlerts();
      return await alertService.getAlerts({ page, limit });
    },
  });

  const filteredAlerts = useMemo(() => {
    const allAlerts = alertsData?.alerts || [];
    if (filterRead === undefined) return allAlerts;
    return allAlerts.filter(alert => alert.isRead === filterRead);
  }, [alertsData, filterRead]);

  const counts = useMemo(() => {
    const all = alertsData?.alerts || [];
    return {
      all: all.length,
      unread: all.filter(a => !a.isRead).length,
      read: all.filter(a => a.isRead).length
    };
  }, [alertsData]);

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (alertId: string) => alertService.markAsRead(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('Alert oznaczony jako przeczytany');
    },
    onError: () => {
      toast.error('Błąd przy oznaczaniu alertu');
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => alertService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('Wszystkie alerty oznaczone jako przeczytane');
    },
    onError: () => {
      toast.error('Błąd przy oznaczaniu alertów');
    },
  });

  const getAlertIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-orange-50 border-orange-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatLessonDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAlertDetails = (alert: Alert) => {
    const metadata = alert.metadata;
    if (!metadata) return null;

    // Render lesson details for lesson-related alerts
    if (metadata.lessons && Array.isArray(metadata.lessons)) {
      const lessons = metadata.lessons as LessonDetail[];
      const displayLessons = lessons.slice(0, 5); // Show max 5 lessons
      const remainingCount = lessons.length - displayLessons.length;

      return (
        <div className="mt-3 space-y-2">
          {displayLessons.map((lesson) => (
            <div
              key={lesson.id}
              className="bg-white/60 rounded-lg p-3 border border-gray-200/50"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <BookOpen className="h-4 w-4 text-gray-500" />
                {lesson.title}
              </div>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Lektor: {lesson.teacherName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{formatLessonDate(lesson.scheduledAt)}</span>
                </div>
                <div className="flex items-center gap-1 sm:col-span-2">
                  <User className="h-3 w-3" />
                  <span>Uczeń: {lesson.studentName}</span>
                </div>
              </div>
            </div>
          ))}
          {remainingCount > 0 && (
            <p className="text-xs text-gray-500 italic">
              ...i {remainingCount} więcej lekcji
            </p>
          )}
        </div>
      );
    }

    // Render student details for student-related alerts
    if (metadata.students && Array.isArray(metadata.students)) {
      const students = metadata.students as StudentDetail[];
      const displayStudents = students.slice(0, 8); // Show max 8 students
      const remainingCount = students.length - displayStudents.length;

      return (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {displayStudents.map((student) => (
              <span
                key={student.id}
                className="inline-flex items-center gap-1 bg-white/60 px-2 py-1 rounded-lg border border-gray-200/50 text-sm text-gray-700"
              >
                <User className="h-3 w-3 text-gray-500" />
                {student.name}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 text-xs text-gray-500 italic">
                ...i {remainingCount} więcej
              </span>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  const handleMarkAsRead = (alertId: string) => {
    markAsReadMutation.mutate(alertId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingSpinner message="Ładowanie alertów..." />
      </div>
    );
  }

  const alerts = alertsData?.alerts || [];
  const pagination = alertsData?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerty</h1>
          <p className="mt-2 text-gray-600">
            Zarządzaj powiadomieniami i alertami systemowymi
          </p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          disabled={markAllAsReadMutation.isPending || alerts.every(a => a.isRead)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCheck className="h-4 w-4" />
          Oznacz wszystkie jako przeczytane
        </button>
      </div>

{/* Filter Tabs - teraz zmieniają tylko lokalny stan filterRead */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterRead(undefined)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterRead === undefined ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Wszystkie ({counts.all})
          </button>
          <button
            onClick={() => setFilterRead(false)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterRead === false ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Nieprzeczytane ({counts.unread})
          </button>
          <button
            onClick={() => setFilterRead(true)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterRead === true ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Przeczytane ({counts.read})
          </button>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
            <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Brak alertów do wyświetlenia</p>
          </div>
        ) : (
          filteredAlerts.map((alert: Alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-lg shadow border p-4 transition-all ${
                getAlertColor(alert.type)
              } ${alert.isRead ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="mt-1">{getAlertIcon(alert.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                      {!alert.isRead && (
                        <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">{alert.message}</p>
                    {renderAlertDetails(alert)}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(alert.createdAt).toLocaleDateString('pl-PL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                {!alert.isRead && (
                  <button
                    onClick={() => handleMarkAsRead(alert.id)}
                    disabled={markAsReadMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    title="Oznacz jako przeczytane"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Strona {pagination.page} z {pagination.totalPages} (łącznie: {pagination.total}{' '}
              alertów)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPage;
