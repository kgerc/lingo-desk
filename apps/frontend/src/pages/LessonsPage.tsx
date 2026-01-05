import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lessonService, Lesson, LessonStatus } from '../services/lessonService';
import LessonModal from '../components/LessonModal';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Calendar,
  Clock,
  User,
  GraduationCap,
  Video,
  MapPin,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const LessonsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LessonStatus | ''>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ['lessons', searchTerm, statusFilter],
    queryFn: () =>
      lessonService.getLessons({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => lessonService.deleteLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => lessonService.confirmLesson(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
    },
  });

  const handleAddLesson = () => {
    setSelectedLesson(null);
    setIsModalOpen(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setIsModalOpen(true);
  };

  const handleDeleteLesson = async (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć tę lekcję?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleConfirmLesson = async (id: string) => {
    if (window.confirm('Czy na pewno chcesz potwierdzić tę lekcję?')) {
      await confirmMutation.mutateAsync(id);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedLesson(null);
  };

  const handleModalSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
    handleModalClose();
  };

  const getStatusBadge = (status: LessonStatus) => {
    const badges: Record<LessonStatus, { text: string; className: string; icon: any }> = {
      SCHEDULED: {
        text: 'Zaplanowana',
        className: 'bg-blue-100 text-blue-800',
        icon: Calendar,
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

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie lekcji..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lekcje</h1>
          <p className="mt-1 text-sm text-gray-500">Zarządzaj lekcjami w systemie</p>
        </div>
        <button
          onClick={handleAddLesson}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Dodaj lekcję
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Lessons Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lekcja
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lektor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uczeń
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data i czas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tryb
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lessons.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Calendar className="h-12 w-12 mb-2 text-gray-400" />
                      <p className="text-lg font-medium">Brak lekcji</p>
                      <p className="text-sm">Dodaj pierwszą lekcję, aby rozpocząć</p>
                    </div>
                  </td>
                </tr>
              ) : (
                lessons.map((lesson) => (
                  <tr key={lesson.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lesson.title}</div>
                        {lesson.course && (
                          <div className="text-xs text-gray-500">{lesson.course.name}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-gray-400" />
                        <div className="text-sm text-gray-900">
                          {lesson.teacher.user.firstName} {lesson.teacher.user.lastName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <div className="text-sm text-gray-900">
                          {lesson.student.user.firstName} {lesson.student.user.lastName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-900">{formatDate(lesson.scheduledAt)}</div>
                          <div className="text-xs text-gray-500">{lesson.durationMinutes} min</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getDeliveryModeIcon(lesson.deliveryMode)}
                        <span className="text-sm text-gray-900">
                          {lesson.deliveryMode === 'ONLINE' ? 'Online' : 'Stacjonarne'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(lesson.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {lesson.status === 'SCHEDULED' && (
                          <button
                            onClick={() => handleConfirmLesson(lesson.id)}
                            className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                            title="Potwierdź lekcję"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditLesson(lesson)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Edytuj"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        {lesson.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Usuń"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <LessonModal lesson={selectedLesson} onClose={handleModalClose} onSuccess={handleModalSuccess} />
      )}
    </div>
  );
};

export default LessonsPage;
