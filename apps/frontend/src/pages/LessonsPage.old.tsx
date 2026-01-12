import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { lessonService, Lesson, LessonStatus } from '../services/lessonService';
import LessonModal from '../components/LessonModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Dropdown from '../components/Dropdown';
import {
  Calendar,
  Clock,
  User,
  GraduationCap,
  Video,
  MapPin,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  XCircle,
  MoreVertical,
} from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const LessonsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LessonStatus | ''>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; lessonId: string | null }>({ isOpen: false, lessonId: null });
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; lessonId: string | null }>({ isOpen: false, lessonId: null });
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  const handleAddLesson = () => {
    setSelectedLesson(null);
    setIsModalOpen(true);
  };

  const handleEditLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
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
        {isLoading ? (
          <div className="py-12">
            <LoadingSpinner message="Ładowanie lekcji..." />
          </div>
        ) : (
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
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <LessonModal lesson={selectedLesson} onClose={handleModalClose} onSuccess={handleModalSuccess} />
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
    </div>
  );
};

export default LessonsPage;
