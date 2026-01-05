import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { lessonService, Lesson, CreateLessonData, LessonDeliveryMode } from '../services/lessonService';
import { teacherService } from '../services/teacherService';
import { studentService } from '../services/studentService';
import { courseService } from '../services/courseService';
import { X } from 'lucide-react';

interface LessonModalProps {
  lesson: Lesson | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LessonModal: React.FC<LessonModalProps> = ({ lesson, onClose, onSuccess }) => {
  const isEdit = !!lesson;

  const [formData, setFormData] = useState({
    courseId: lesson?.courseId || '',
    enrollmentId: lesson?.enrollmentId || '',
    teacherId: lesson?.teacherId || '',
    studentId: lesson?.studentId || '',
    title: lesson?.title || '',
    description: lesson?.description || '',
    scheduledAt: lesson?.scheduledAt ? new Date(lesson.scheduledAt).toISOString().slice(0, 16) : '',
    durationMinutes: lesson?.durationMinutes?.toString() || '60',
    deliveryMode: (lesson?.deliveryMode || 'IN_PERSON') as LessonDeliveryMode,
    meetingUrl: lesson?.meetingUrl || '',
    locationId: lesson?.locationId || '',
    classroomId: lesson?.classroomId || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch teachers for dropdown
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => teacherService.getTeachers({ isActive: true }),
  });

  // Fetch students for dropdown
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents({ isActive: true }),
  });

  // Fetch courses for dropdown
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseService.getCourses({ isActive: true }),
  });

  // Fetch enrollments for selected student
  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', formData.studentId],
    queryFn: async () => {
      if (!formData.studentId) return [];
      const allCourses = await courseService.getCourses({ isActive: true });
      const studentEnrollments: any[] = [];

      allCourses.forEach(course => {
        course.enrollments?.forEach(enrollment => {
          if (enrollment.studentId === formData.studentId && enrollment.status === 'ACTIVE') {
            studentEnrollments.push({
              id: enrollment.id,
              courseId: course.id,
              courseName: course.name,
              courseType: course.courseType,
            });
          }
        });
      });

      return studentEnrollments;
    },
    enabled: !!formData.studentId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLessonData) => lessonService.createLesson(data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      setErrors({
        form: error.response?.data?.error?.message || 'Wystąpił błąd podczas tworzenia lekcji',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      lessonService.updateLesson(data.id, data.updates),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      setErrors({
        form: error.response?.data?.error?.message || 'Wystąpił błąd podczas aktualizacji lekcji',
      });
    },
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }

    // Auto-fill enrollment when student and course are selected
    if (name === 'studentId' || name === 'courseId') {
      const studentId = name === 'studentId' ? value : formData.studentId;
      const courseId = name === 'courseId' ? value : formData.courseId;

      if (studentId && courseId && enrollments.length > 0) {
        const enrollment = enrollments.find((e: any) => e.courseId === courseId);
        if (enrollment) {
          setFormData((prev) => ({ ...prev, enrollmentId: enrollment.id }));
        }
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Tytuł lekcji jest wymagany';
    }

    if (!formData.teacherId) {
      newErrors.teacherId = 'Lektor jest wymagany';
    }

    if (!formData.studentId) {
      newErrors.studentId = 'Uczeń jest wymagany';
    }

    if (!formData.enrollmentId) {
      newErrors.enrollmentId = 'Wybierz kurs dla ucznia';
    }

    if (!formData.scheduledAt) {
      newErrors.scheduledAt = 'Data i godzina lekcji są wymagane';
    }

    if (!formData.durationMinutes || parseInt(formData.durationMinutes) <= 0) {
      newErrors.durationMinutes = 'Czas trwania musi być większy od 0';
    }

    if (formData.deliveryMode === 'ONLINE' && formData.meetingUrl && !isValidUrl(formData.meetingUrl)) {
      newErrors.meetingUrl = 'Podaj prawidłowy URL spotkania';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data: any = {
      courseId: formData.courseId || undefined,
      enrollmentId: formData.enrollmentId,
      teacherId: formData.teacherId,
      studentId: formData.studentId,
      title: formData.title,
      description: formData.description || undefined,
      scheduledAt: new Date(formData.scheduledAt).toISOString(),
      durationMinutes: parseInt(formData.durationMinutes),
      deliveryMode: formData.deliveryMode,
      meetingUrl: formData.meetingUrl || undefined,
      locationId: formData.locationId || undefined,
      classroomId: formData.classroomId || undefined,
    };

    if (isEdit && lesson) {
      await updateMutation.mutateAsync({ id: lesson.id, updates: data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edytuj lekcję' : 'Dodaj nową lekcję'}
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

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tytuł lekcji *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="np. Lekcja angielskiego - gramatyka"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opis (opcjonalnie)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Opis lekcji, tematy do omówienia..."
              />
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Uczestnicy</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              {/* Student */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uczeń *
                </label>
                <select
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.studentId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Wybierz ucznia</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.user.firstName} {student.user.lastName}
                    </option>
                  ))}
                </select>
                {errors.studentId && (
                  <p className="mt-1 text-sm text-red-600">{errors.studentId}</p>
                )}
              </div>

              {/* Course (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kurs (opcjonalnie)
                </label>
                <select
                  name="courseId"
                  value={formData.courseId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Wybierz kurs</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Enrollment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zapisy ucznia *
                </label>
                <select
                  name="enrollmentId"
                  value={formData.enrollmentId}
                  onChange={handleChange}
                  disabled={!formData.studentId}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 ${
                    errors.enrollmentId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">
                    {!formData.studentId
                      ? 'Najpierw wybierz ucznia'
                      : enrollments.length === 0
                      ? 'Brak aktywnych zapisów na kursy'
                      : 'Wybierz kurs'}
                  </option>
                  {enrollments.map((enrollment: any) => (
                    <option key={enrollment.id} value={enrollment.id}>
                      {enrollment.courseName}
                    </option>
                  ))}
                </select>
                {errors.enrollmentId && (
                  <p className="mt-1 text-sm text-red-600">{errors.enrollmentId}</p>
                )}
                {formData.studentId && enrollments.length === 0 && (
                  <p className="mt-1 text-sm text-amber-600">
                    Ten uczeń nie ma aktywnych zapisów na żaden kurs. Najpierw zapisz ucznia na kurs.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Harmonogram</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scheduled At */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data i godzina *
                </label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  value={formData.scheduledAt}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.scheduledAt ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.scheduledAt && (
                  <p className="mt-1 text-sm text-red-600">{errors.scheduledAt}</p>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Czas trwania (minuty) *
                </label>
                <input
                  type="number"
                  name="durationMinutes"
                  value={formData.durationMinutes}
                  onChange={handleChange}
                  min="15"
                  step="15"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.durationMinutes ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.durationMinutes && (
                  <p className="mt-1 text-sm text-red-600">{errors.durationMinutes}</p>
                )}
              </div>
            </div>
          </div>

          {/* Delivery */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Sposób przeprowadzenia</h3>

            {/* Delivery Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tryb *
              </label>
              <select
                name="deliveryMode"
                value={formData.deliveryMode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="IN_PERSON">Stacjonarne</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>

            {/* Meeting URL (for online lessons) */}
            {formData.deliveryMode === 'ONLINE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link do spotkania
                </label>
                <input
                  type="url"
                  name="meetingUrl"
                  value={formData.meetingUrl}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.meetingUrl ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://zoom.us/j/..."
                />
                {errors.meetingUrl && (
                  <p className="mt-1 text-sm text-red-600">{errors.meetingUrl}</p>
                )}
              </div>
            )}
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
                : 'Dodaj lekcję'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonModal;
