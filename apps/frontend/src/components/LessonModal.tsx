import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { lessonService, Lesson, CreateLessonData, LessonDeliveryMode } from '../services/lessonService';
import { teacherService } from '../services/teacherService';
import { studentService } from '../services/studentService';
import { courseService } from '../services/courseService';
import { X, ChevronDown } from 'lucide-react';
import AttendanceSection from './AttendanceSection';

interface LessonModalProps {
  lesson: Lesson | null;
  initialDate?: Date;
  initialDuration?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const LessonModal: React.FC<LessonModalProps> = ({ lesson, initialDate, initialDuration, onClose, onSuccess }) => {
  const isEdit = !!lesson;
  const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);

  const [formData, setFormData] = useState({
    courseId: lesson?.courseId || '',
    enrollmentId: lesson?.enrollmentId || '',
    teacherId: lesson?.teacherId || '',
    studentId: lesson?.studentId || '',
    title: lesson?.title || '',
    description: lesson?.description || '',
    scheduledAt: lesson?.scheduledAt
      ? new Date(lesson.scheduledAt).toISOString().slice(0, 16)
      : initialDate
        ? new Date(initialDate).toISOString().slice(0, 16)
        : '',
    durationMinutes: lesson?.durationMinutes?.toString() || initialDuration?.toString() || '60',
    deliveryMode: (lesson?.deliveryMode || 'IN_PERSON') as LessonDeliveryMode,
    meetingUrl: lesson?.meetingUrl || '',
    locationId: lesson?.locationId || '',
    classroomId: lesson?.classroomId || '',
    status: lesson?.status || 'SCHEDULED',
  });

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringPattern, setRecurringPattern] = useState({
    frequency: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
    interval: 1,
    daysOfWeek: [] as number[],
    endDate: '',
    occurrencesCount: '',
  });
  const [recurringType, setRecurringType] = useState<'weeks' | 'months'>('weeks');
  const [recurringCount, setRecurringCount] = useState<string>('4');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<any>(null);

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

  // Check for conflicts when teacher, student, time, or duration changes
  const { data: conflictData, isLoading: isCheckingConflicts } = useQuery({
    queryKey: ['conflicts', formData.teacherId, formData.studentId, formData.scheduledAt, formData.durationMinutes],
    queryFn: async () => {
      if (!formData.teacherId || !formData.studentId || !formData.scheduledAt || !formData.durationMinutes) {
        return null;
      }

      try {
        const conflicts = await lessonService.checkConflicts(
          formData.teacherId,
          formData.studentId,
          formData.scheduledAt,
          Number(formData.durationMinutes),
          lesson?.id
        );
        setConflicts(conflicts);
        return conflicts;
      } catch (error) {
        console.error('Error checking conflicts:', error);
        return null;
      }
    },
    enabled: !!(formData.teacherId && formData.studentId && formData.scheduledAt && formData.durationMinutes),
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateLessonData) => lessonService.createLesson(data),
    onSuccess: () => {
      toast.success('Lekcja została pomyślnie utworzona');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas tworzenia lekcji';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data: {
      lessonData: CreateLessonData;
      pattern: {
        frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
        interval?: number;
        daysOfWeek?: number[];
        startDate: string;
        endDate?: string;
        occurrencesCount?: number;
      };
    }) => lessonService.createRecurringLessons(data.lessonData, data.pattern),
    onSuccess: (result) => {
      toast.success(`Utworzono ${result.totalCreated} cyklicznych lekcji${result.totalErrors > 0 ? ` (pominięto ${result.totalErrors} z powodu konfliktów)` : ''}`);
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas tworzenia cyklicznych lekcji';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: any }) =>
      lessonService.updateLesson(data.id, data.updates),
    onSuccess: () => {
      toast.success('Lekcja została pomyślnie zaktualizowana');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas aktualizacji lekcji';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
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

    // Check for scheduling conflicts
    if (conflicts && conflicts.hasConflicts) {
      newErrors.form = 'Nie można zapisać lekcji - wykryto konflikt terminów. Zmień termin lub czas trwania.';
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
      status: isEdit ? formData.status : 'SCHEDULED' as const,
    };

    if (isEdit && lesson) {
      await updateMutation.mutateAsync({ id: lesson.id, updates: data });
    } else if (isRecurring) {
      // Create recurring lessons with simplified pattern
      const count = parseInt(recurringCount) || 1;
      const frequency = recurringType === 'weeks' ? 'WEEKLY' : 'MONTHLY';

      await createRecurringMutation.mutateAsync({
        lessonData: data,
        pattern: {
          frequency: frequency as 'WEEKLY' | 'MONTHLY',
          interval: 1,
          startDate: new Date(formData.scheduledAt).toISOString(),
          occurrencesCount: count,
        },
      });
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
            <button
              type="button"
              onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
              className="w-full flex items-center justify-between text-lg font-semibold text-gray-900 hover:text-primary transition-colors"
            >
              <span>Uczestnicy</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${
                  isParticipantsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isParticipantsExpanded && (
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
            )}
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

            {/* Conflict Warnings */}
            {isCheckingConflicts && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-700">Sprawdzanie dostępności...</p>
              </div>
            )}

            {conflicts && conflicts.hasConflicts && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium text-red-800">Wykryto konflikt terminów!</p>

                    {conflicts.teacherConflicts.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700">Lektor jest zajęty:</p>
                        <ul className="mt-1 space-y-1">
                          {conflicts.teacherConflicts.map((conflict: any) => (
                            <li key={conflict.id} className="text-sm text-red-600">
                              • {new Date(conflict.scheduledAt).toLocaleString('pl-PL')} ({conflict.durationMinutes} min) - {conflict.studentName}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {conflicts.studentConflicts.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-red-700">Uczeń jest zajęty:</p>
                        <ul className="mt-1 space-y-1">
                          {conflicts.studentConflicts.map((conflict: any) => (
                            <li key={conflict.id} className="text-sm text-red-600">
                              • {new Date(conflict.scheduledAt).toLocaleString('pl-PL')} ({conflict.durationMinutes} min) - {conflict.teacherName}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {conflicts && !conflicts.hasConflicts && formData.teacherId && formData.studentId && formData.scheduledAt && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-green-700 font-medium">Termin dostępny ✓</p>
                </div>
              </div>
            )}
          </div>

          {/* Recurring Lessons - only show for new lessons */}
          {!isEdit && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Lekcje cykliczne</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Utwórz serię lekcji</span>
                </label>
              </div>

              {isRecurring && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Count */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Liczba
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={recurringCount}
                        onChange={(e) => setRecurringCount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="np. 4"
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Okres
                      </label>
                      <select
                        value={recurringType}
                        onChange={(e) => setRecurringType(e.target.value as 'weeks' | 'months')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="weeks">Tygodni</option>
                        <option value="months">Miesięcy</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="font-medium text-blue-800">Informacja:</p>
                    <p className="mt-1">
                      System utworzy {recurringCount || '0'} {recurringType === 'weeks' ? 'tygodni' : 'miesięcy'} lekcji
                      w tym samym dniu tygodnia i o tej samej godzinie.
                      Lekcje z konfliktami harmonogramu zostaną automatycznie pominięte.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Status (only for edit mode) */}
          {isEdit && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Status lekcji</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="SCHEDULED">Zaplanowana</option>
                  <option value="CONFIRMED">Potwierdzona</option>
                  <option value="COMPLETED">Zakończona (odliczy godziny z budżetu)</option>
                  <option value="CANCELLED">Anulowana</option>
                  <option value="PENDING_CONFIRMATION">Oczekująca na potwierdzenie</option>
                  <option value="NO_SHOW">Nieobecność</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.status === 'COMPLETED' ? (
                    <span className="text-amber-600 font-medium">
                      ⚠️ Oznaczenie lekcji jako zakończonej automatycznie odliczy godziny z budżetu ucznia
                    </span>
                  ) : (
                    'Zmień status lekcji w zależności od jej przebiegu'
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Attendance (only for edit mode) */}
          {isEdit && lesson && (
            <AttendanceSection lesson={lesson} />
          )}

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
              disabled={createMutation.isPending || updateMutation.isPending || createRecurringMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending || createRecurringMutation.isPending
                ? isRecurring
                  ? 'Tworzenie serii lekcji...'
                  : 'Zapisywanie...'
                : isEdit
                ? 'Zapisz zmiany'
                : isRecurring
                ? 'Utwórz serię lekcji'
                : 'Dodaj lekcję'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LessonModal;
