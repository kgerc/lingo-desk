import toast from 'react-hot-toast';
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { courseService, Course } from '../services/courseService';
import { Plus, Search, Users, BookOpen, Calendar, MapPin, Wifi, Home, MoreVertical, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import CourseModal from '../components/CourseModal';
import EnrollStudentModal from '../components/EnrollStudentModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Dropdown from '../components/Dropdown';

const CoursesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const canAccessSettlements = ['ADMIN', 'MANAGER'].includes(user?.role || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [courseForEnrollment, setCourseForEnrollment] = useState<Course | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; courseId: string | null }>({ isOpen: false, courseId: null });
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Fetch courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', searchTerm],
    queryFn: () => courseService.getCourses({ search: searchTerm }),
  });

  // Fetch delete impact when dialog is open
  const { data: deleteImpact, isLoading: isImpactLoading } = useQuery({
    queryKey: ['course-delete-impact', confirmDialog.courseId],
    queryFn: () => courseService.getDeleteImpact(confirmDialog.courseId!),
    enabled: confirmDialog.isOpen && !!confirmDialog.courseId,
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => courseService.bulkDeleteCourses(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      setSelectedIds(new Set());
      if (result.failed === 0) {
        toast.success(`Usunięto ${result.deleted} kursów`);
      } else {
        toast.error(`Usunięto ${result.deleted}, błędy: ${result.failed}`);
      }
    },
    onError: () => {
      toast.error('Błąd podczas usuwania kursów');
    },
  });

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === courses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(courses.map((c) => c.id)));
    }
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => courseService.deleteCourse(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Kurs został pomyślnie usunięty');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania kursu');
    },
  });

  const handleEdit = (course: Course) => {
    setSelectedCourse(course);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, courseId: id });
  };

  const confirmDelete = async () => {
    if (confirmDialog.courseId) {
      const hasImpact = deleteImpact && (deleteImpact.activeEnrollments > 0 || deleteImpact.futureLessons > 0);
      await deleteMutation.mutateAsync({ id: confirmDialog.courseId, force: !!hasImpact });
    }
  };

  const handleManageStudents = (course: Course) => {
    setCourseForEnrollment(course);
    setIsEnrollModalOpen(true);
  };

  const handleViewSchedule = (courseId: string) => {
    navigate(`/lessons?courseId=${courseId}&view=calendar`);
  };

  const handleGroupSettlement = (courseId: string) => {
    navigate(`/payments?tab=settlements&courseId=${courseId}`);
  };

  const handleCopy = (course: Course) => {
    setSelectedCourse(course);
    setIsCopyMode(true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCourse(null);
    setIsCopyMode(false);
  };

  const handleCloseEnrollModal = () => {
    setIsEnrollModalOpen(false);
    setCourseForEnrollment(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['courses'] });
    handleCloseModal();
  };

  const getLanguageLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      A1: 'bg-green-100 text-green-800',
      A2: 'bg-green-200 text-green-900',
      B1: 'bg-blue-100 text-blue-800',
      B2: 'bg-blue-200 text-blue-900',
      C1: 'bg-purple-100 text-purple-800',
      C2: 'bg-purple-200 text-purple-900',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[level] || 'bg-gray-100 text-gray-800'}`}>
        {level}
      </span>
    );
  };

  const getDeliveryModeIcon = (mode: string) => {
    switch (mode) {
      case 'ONLINE':
        return <Wifi className="h-4 w-4 text-blue-600" />;
      case 'IN_PERSON':
        return <Home className="h-4 w-4 text-green-600" />;
      case 'BOTH':
        return <MapPin className="h-4 w-4 text-purple-600" />;
      default:
        return null;
    }
  };

  const getDeliveryModeLabel = (mode: string) => {
    switch (mode) {
      case 'ONLINE':
        return 'Online';
      case 'IN_PERSON':
        return 'Stacjonarne';
      case 'BOTH':
        return 'Hybrydowe';
      default:
        return mode;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getCourseTypeBadge = (type: string) => {
    if (type === 'GROUP') {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
          Grupowy
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-teal-100 text-teal-800">
        Indywidualny
      </span>
    );
  };

  const allSelected = courses.length > 0 && selectedIds.size === courses.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kursy</h1>
          <p className="mt-2 text-gray-600">
            Zarządzaj kursami i pakietami ({courses.length} kursów)
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Dodaj kurs
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj kursu po nazwie, opisie lub lektorze..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">
            Zaznaczono {selectedIds.size} {selectedIds.size === 1 ? 'kurs' : selectedIds.size < 5 ? 'kursy' : 'kursów'}
          </span>
          <button
            onClick={() => setBulkConfirmOpen(true)}
            disabled={bulkDeleteMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {bulkDeleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Usuń zaznaczone
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-blue-600 hover:underline"
          >
            Odznacz wszystkie
          </button>
        </div>
      )}

      {/* Courses Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Ładowanie kursów..." />
        ) : courses.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {searchTerm ? 'Nie znaleziono kursów' : 'Brak kursów. Dodaj pierwszy kurs!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kurs
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lektor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Poziom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tryb
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uczestnicy
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data rozpoczęcia
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
                {courses.map((course) => {
                  const isSelected = selectedIds.has(course.id);
                  return (
                  <tr key={course.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(course.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{course.name}</div>
                          <div className="text-xs text-gray-500">{course.language}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {course.teacher ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {course.teacher.user.firstName} {course.teacher.user.lastName}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Brak lektora</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getCourseTypeBadge(course.courseType)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getLanguageLevelBadge(course.level)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getDeliveryModeIcon(course.deliveryMode)}
                        <span className="text-sm text-gray-900">
                          {getDeliveryModeLabel(course.deliveryMode)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">
                          {course.enrollments?.length || 0}
                          {course.maxStudents ? `/${course.maxStudents}` : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900">{formatDate(course.startDate)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          course.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {course.isActive ? 'Aktywny' : 'Nieaktywny'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        ref={(el) => {
                          if (el) {
                            dropdownTriggerRefs.current.set(course.id, el);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === course.id ? null : course.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Więcej opcji"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-600" />
                      </button>
                      <Dropdown
                        isOpen={openDropdownId === course.id}
                        onClose={() => setOpenDropdownId(null)}
                        triggerRef={{ current: dropdownTriggerRefs.current.get(course.id) || null }}
                        items={[
                          {
                            label: 'Zobacz grafik',
                            onClick: () => handleViewSchedule(course.id),
                          },
                          {
                            label: 'Zarządzaj uczniami',
                            onClick: () => handleManageStudents(course),
                          },
                          ...(course.courseType === 'GROUP' && canAccessSettlements
                            ? [{
                                label: 'Rozlicz grupę',
                                onClick: () => handleGroupSettlement(course.id),
                                disabled: (course.enrollments?.length || 0) === 0,
                              }]
                            : []),
                          {
                            label: 'Kopiuj kurs',
                            onClick: () => handleCopy(course),
                          },
                          {
                            label: 'Edytuj kurs',
                            onClick: () => handleEdit(course),
                          },
                          {
                            label: 'Usuń kurs',
                            onClick: () => handleDelete(course.id),
                            variant: 'danger' as const,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Course Modal */}
      {isModalOpen && (
        <CourseModal
          course={selectedCourse}
          isCopy={isCopyMode}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}

      {/* Enroll Student Modal */}
      {isEnrollModalOpen && courseForEnrollment && (
        <EnrollStudentModal
          course={courseForEnrollment}
          onClose={handleCloseEnrollModal}
        />
      )}

      {/* Confirm Delete Dialog */}
      {(() => {
        const hasImpact = deleteImpact && (deleteImpact.activeEnrollments > 0 || deleteImpact.futureLessons > 0);
        const details = deleteImpact ? [
          ...(deleteImpact.activeEnrollments > 0 ? [{
            label: 'Aktywne zapisy uczniów',
            value: deleteImpact.enrolledStudents.length > 0
              ? `${deleteImpact.activeEnrollments} (${deleteImpact.enrolledStudents.join(', ')})`
              : deleteImpact.activeEnrollments,
            highlight: true,
          }] : []),
          ...(deleteImpact.futureLessons > 0 ? [{
            label: 'Zaplanowane przyszłe lekcje',
            value: deleteImpact.futureLessons,
            highlight: true,
          }] : []),
          ...(deleteImpact.pastLessons > 0 ? [{
            label: 'Historyczne lekcje (zostaną zachowane)',
            value: deleteImpact.pastLessons,
            highlight: false,
          }] : []),
        ] : undefined;

        return (
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            onClose={() => setConfirmDialog({ isOpen: false, courseId: null })}
            onConfirm={confirmDelete}
            title="Usuń kurs"
            message={
              hasImpact
                ? 'Ten kurs ma powiązane dane. Usunięcie spowoduje anulowanie zaplanowanych lekcji i wypisanie uczniów. Ta operacja jest nieodwracalna.'
                : 'Czy na pewno chcesz usunąć ten kurs? Ta operacja jest nieodwracalna.'
            }
            confirmText={hasImpact ? 'Usuń mimo to' : 'Usuń'}
            cancelText="Anuluj"
            variant="danger"
            details={details}
            isLoading={isImpactLoading}
          />
        );
      })()}

      {/* Confirm Bulk Delete Dialog */}
      <ConfirmDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title="Usuń zaznaczone kursy"
        message={`Czy na pewno chcesz usunąć ${selectedIds.size} zaznaczonych kursów? Ta operacja jest nieodwracalna.`}
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />
    </div>
  );
};

export default CoursesPage;
