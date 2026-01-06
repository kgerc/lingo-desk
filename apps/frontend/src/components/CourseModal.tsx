import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { courseService, Course, CreateCourseData } from '../services/courseService';
import { teacherService } from '../services/teacherService';
import { courseTypeService } from '../services/courseTypeService';
import { X } from 'lucide-react';

interface CourseModalProps {
  course: Course | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CourseModal: React.FC<CourseModalProps> = ({ course, onClose, onSuccess }) => {
  const isEdit = !!course;

  const [formData, setFormData] = useState({
    courseTypeId: course?.courseTypeId || '',
    teacherId: course?.teacherId || '',
    name: course?.name || '',
    maxStudents: course?.maxStudents?.toString() || '',
    startDate: course?.startDate ? course.startDate.split('T')[0] : '',
    endDate: course?.endDate ? course.endDate.split('T')[0] : '',
    isActive: course?.isActive ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch teachers for dropdown
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => teacherService.getTeachers({ isActive: true }),
  });

  // Fetch course types for dropdown
  const { data: courseTypes = [] } = useQuery({
    queryKey: ['courseTypes'],
    queryFn: () => courseTypeService.getCourseTypes(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCourseData) => courseService.createCourse(data),
    onSuccess: () => {
      toast.success('Kurs został pomyślnie utworzony');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas tworzenia kursu';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      courseService.updateCourse(data.id, data.updates),
    onSuccess: () => {
      toast.success('Kurs został pomyślnie zaktualizowany');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas aktualizacji kursu';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa kursu jest wymagana';
    }

    if (!formData.courseTypeId) {
      newErrors.courseTypeId = 'Typ kursu jest wymagany';
    }

    if (!formData.teacherId) {
      newErrors.teacherId = 'Lektor jest wymagany';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Data rozpoczęcia jest wymagana';
    }

    if (formData.maxStudents && parseInt(formData.maxStudents) <= 0) {
      newErrors.maxStudents = 'Maksymalna liczba uczestników musi być większa od 0';
    }

    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data: any = {
      courseTypeId: formData.courseTypeId,
      teacherId: formData.teacherId,
      name: formData.name,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      maxStudents: formData.maxStudents ? parseInt(formData.maxStudents) : undefined,
      isActive: formData.isActive,
    };

    if (isEdit && course) {
      await updateMutation.mutateAsync({ id: course.id, updates: data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edytuj kurs' : 'Dodaj nowy kurs'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.form}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Podstawowe informacje</h3>

            {/* Course Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Typ kursu *
              </label>
              <select
                name="courseTypeId"
                value={formData.courseTypeId}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.courseTypeId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Wybierz typ kursu</option>
                {courseTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.level}, {type.language})
                  </option>
                ))}
              </select>
              {errors.courseTypeId && (
                <p className="mt-1 text-sm text-red-600">{errors.courseTypeId}</p>
              )}
            </div>

            {/* Teacher */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lektor *
              </label>
              <select
                name="teacherId"
                value={formData.teacherId}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.teacherId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Wybierz lektora</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.user.firstName} {teacher.user.lastName}
                  </option>
                ))}
              </select>
              {errors.teacherId && (
                <p className="mt-1 text-sm text-red-600">{errors.teacherId}</p>
              )}
            </div>

            {/* Course Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nazwa kursu *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="np. Angielski B1 - środa 18:00"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>
          </div>

          {/* Course Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Szczegóły kursu</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Max Students */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maksymalna liczba uczestników
                </label>
                <input
                  type="number"
                  name="maxStudents"
                  value={formData.maxStudents}
                  onChange={handleChange}
                  min="1"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.maxStudents ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="np. 10"
                />
                {errors.maxStudents && (
                  <p className="mt-1 text-sm text-red-600">{errors.maxStudents}</p>
                )}
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data rozpoczęcia *
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.startDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                )}
              </div>

              {/* End Date */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data zakończenia (opcjonalnie)
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.endDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label className="ml-2 block text-sm text-gray-700">Kurs aktywny</label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Zapisywanie...'
                : isEdit
                ? 'Zapisz zmiany'
                : 'Dodaj kurs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseModal;
