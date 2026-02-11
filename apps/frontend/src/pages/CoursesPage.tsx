import toast from 'react-hot-toast';
import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { courseService, Course } from '../services/courseService';
import { Plus, Search, Users, BookOpen, Calendar, MapPin, Wifi, Home, MoreVertical } from 'lucide-react';
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
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Fetch courses
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', searchTerm],
    queryFn: () => courseService.getCourses({ search: searchTerm }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => courseService.deleteCourse(id),
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
      await deleteMutation.mutateAsync(confirmDialog.courseId);
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
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-gray-50 transition-colors">
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
                ))}
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
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, courseId: null })}
        onConfirm={confirmDelete}
        title="Usuń kurs"
        message="Czy na pewno chcesz usunąć ten kurs? Ta operacja jest nieodwracalna."
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />
    </div>
  );
};

export default CoursesPage;
