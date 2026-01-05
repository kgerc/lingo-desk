import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseService, Course } from '../services/courseService';
import { Plus, Search, Edit, Trash2, Users, BookOpen, Calendar, MapPin, Wifi, Home, UserPlus } from 'lucide-react';
import CourseModal from '../components/CourseModal';
import EnrollStudentModal from '../components/EnrollStudentModal';

const CoursesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [courseForEnrollment, setCourseForEnrollment] = useState<Course | null>(null);

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
    },
  });

  const handleEdit = (course: Course) => {
    setSelectedCourse(course);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Czy na pewno chcesz usunąć ten kurs?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleManageStudents = (course: Course) => {
    setCourseForEnrollment(course);
    setIsEnrollModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCourse(null);
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
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
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
          <div className="p-12 text-center text-gray-500">Ładowanie...</div>
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
                          <div className="text-xs text-gray-500">{course.courseType.name}</div>
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
                      {getLanguageLevelBadge(course.courseType.level)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getDeliveryModeIcon(course.courseType.deliveryMode)}
                        <span className="text-sm text-gray-900">
                          {getDeliveryModeLabel(course.courseType.deliveryMode)}
                        </span>
                      </div>
                    </td>                    <td className="px-6 py-4 whitespace-nowrap text-sm">
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleManageStudents(course)}
                          className="text-green-600 hover:text-green-900"
                          title="Zarządzaj uczniami"
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(course)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Edytuj"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(course.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Usuń"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
    </div>
  );
};

export default CoursesPage;
