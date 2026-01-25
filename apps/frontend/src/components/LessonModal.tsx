import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { lessonService, Lesson, CreateLessonData, LessonDeliveryMode } from '../services/lessonService';
import { teacherService } from '../services/teacherService';
import { studentService } from '../services/studentService';
import { courseService } from '../services/courseService';
import substitutionService from '../services/substitutionService';
import { X, Users as UsersIcon, Clock, ClipboardList, Info, XCircle } from 'lucide-react';
import AttendanceSection from './AttendanceSection';
import CancelLessonDialog from './CancelLessonDialog';

interface LessonModalProps {
  lesson: Lesson | null;
  initialDate?: Date;
  initialDuration?: number;
  initialCourseId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

type CreateTabType = 'basic' | 'schedule' | 'participants';
type EditTabType = 'basic' | 'schedule' | 'participants' | 'attendance';

const LessonModal: React.FC<LessonModalProps> = ({ lesson, initialDate, initialDuration, initialCourseId, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const isEdit = !!lesson;
  const [activeTab, setActiveTab] = useState<CreateTabType | EditTabType>('basic');

  const [formData, setFormData] = useState({
    courseId: lesson?.courseId || initialCourseId || '',
    teacherId: lesson?.teacherId || '',
    studentIds: lesson ? [lesson.studentId] : [] as string[],
    title: lesson?.title || '',
    description: lesson?.description || '',
    scheduledAt: lesson?.scheduledAt
      ? new Date(lesson.scheduledAt).toISOString().slice(0, 16)
      : initialDate
        ? new Date(initialDate).toISOString().slice(0, 16)
        : '',
    durationMinutes: lesson?.durationMinutes?.toString() || initialDuration?.toString() || '60',
    pricePerLesson: lesson?.pricePerLesson?.toString() || '',
    currency: lesson?.currency || 'PLN',
    deliveryMode: (lesson?.deliveryMode || 'IN_PERSON') as LessonDeliveryMode,
    meetingUrl: lesson?.meetingUrl || '',
    locationId: lesson?.locationId || '',
    classroomId: lesson?.classroomId || '',
    status: lesson?.status || 'SCHEDULED',
  });

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'weeks' | 'months'>('weeks');
  const [recurringCount, setRecurringCount] = useState<string>('4');

  const [isSubstitution, setIsSubstitution] = useState(false);
  const [substituteTeacherId, setSubstituteTeacherId] = useState('');
  const [substitutionReason, setSubstitutionReason] = useState('');
  const [substitutionNotes, setSubstitutionNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [priceWasManuallySet, setPriceWasManuallySet] = useState(!!lesson?.pricePerLesson);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Fetch existing substitution if editing
  const { data: existingSubstitution } = useQuery({
    queryKey: ['substitution', lesson?.id],
    queryFn: () => lesson ? substitutionService.getSubstitutionByLessonId(lesson.id) : null,
    enabled: !!lesson,
  });

  // Load substitution data if exists
  useEffect(() => {
    if (existingSubstitution) {
      setIsSubstitution(true);
      setSubstituteTeacherId(existingSubstitution.substituteTeacherId);
      setSubstitutionReason(existingSubstitution.reason || '');
      setSubstitutionNotes(existingSubstitution.notes || '');
    }
  }, [existingSubstitution]);

  // Fetch teachers - with longer staleTime to reduce refetches
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', 'active'],
    queryFn: () => teacherService.getTeachers({ isActive: true }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch students - with longer staleTime
  const { data: students = [] } = useQuery({
    queryKey: ['students', 'active'],
    queryFn: () => studentService.getStudents({ isActive: true }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch courses - with longer staleTime
  const { data: courses = [] } = useQuery({
    queryKey: ['courses', 'active'],
    queryFn: () => courseService.getCourses({ isActive: true }),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });


  // When course is selected, auto-populate students from that course
  useEffect(() => {
    if (formData.courseId && !isEdit) {
      const selectedCourse = courses.find(c => c.id === formData.courseId);
      if (selectedCourse?.enrollments) {
        const courseStudentIds = selectedCourse.enrollments
          .filter(e => e.status === 'ACTIVE')
          .map(e => e.studentId);
        setFormData(prev => ({ ...prev, studentIds: courseStudentIds }));
      }
    }
  }, [formData.courseId, courses, isEdit]);

  // Auto-calculate lesson price based on course price or teacher hourly rate (only when creating)
  // Priority: courseType.pricePerLesson > teacher.hourlyRate
  useEffect(() => {
    if (!isEdit && !priceWasManuallySet && formData.durationMinutes) {
      const durationMinutes = Number(formData.durationMinutes);
      const baseDuration = 60; // base duration for price calculation

      // First priority: if course is selected, use courseType price
      if (formData.courseId) {
        const selectedCourse = courses.find(c => c.id === formData.courseId);
        const courseTypePrice = selectedCourse?.courseType?.pricePerLesson;
        if (courseTypePrice !== undefined && courseTypePrice !== null) {
          // Scale price proportionally based on duration
          const calculatedPrice = (Number(courseTypePrice) / baseDuration) * durationMinutes;
          setFormData(prev => ({ ...prev, pricePerLesson: calculatedPrice.toFixed(2) }));
          return;
        }
      }

      // Fallback: use teacher hourly rate
      if (formData.teacherId) {
        const selectedTeacher = teachers.find(t => t.id === formData.teacherId);
        if (selectedTeacher?.hourlyRate) {
          const durationHours = durationMinutes / 60;
          const calculatedPrice = selectedTeacher.hourlyRate * durationHours;
          setFormData(prev => ({ ...prev, pricePerLesson: calculatedPrice.toFixed(2) }));
        }
      }
    }
  }, [formData.teacherId, formData.durationMinutes, formData.courseId, teachers, courses, isEdit, priceWasManuallySet]);

  const createMutation = useMutation({
    mutationFn: async (data: { lessonData: CreateLessonData; studentIds: string[] }) => {
      const promises = data.studentIds.map(studentId => {
        let enrollmentId = '';
        if (formData.courseId) {
          const course = courses.find(c => c.id === formData.courseId);
          const enrollment = course?.enrollments?.find(
            e => e.studentId === studentId && e.status === 'ACTIVE'
          );
          enrollmentId = enrollment?.id || '';
        }

        return lessonService.createLesson({
          ...data.lessonData,
          studentId,
          enrollmentId,
        });
      });

      return Promise.all(promises);
    },
    onSuccess: (results) => {
      toast.success(`Utworzono ${results.length} ${results.length === 1 ? 'lekcję' : 'lekcji'}`);
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas tworzenia lekcji';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: {
      lessonData: CreateLessonData;
      pattern: any;
      studentIds: string[];
    }) => {
      const promises = data.studentIds.map(studentId => {
        let enrollmentId = '';
        if (formData.courseId) {
          const course = courses.find(c => c.id === formData.courseId);
          const enrollment = course?.enrollments?.find(
            e => e.studentId === studentId && e.status === 'ACTIVE'
          );
          enrollmentId = enrollment?.id || '';
        }

        return lessonService.createRecurringLessons(
          {
            ...data.lessonData,
            studentId,
            enrollmentId,
          },
          data.pattern
        );
      });

      const results = await Promise.all(promises);
      const totalCreated = results.reduce((sum, r) => sum + r.totalCreated, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.totalErrors, 0);

      return { totalCreated, totalErrors };
    },
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
    onSuccess: async (_data, variables) => {
      const hadSubstitution = !!existingSubstitution;
      const hasSubstitutionNow = isSubstitution && !!substituteTeacherId;

      const substitutionDataChanged = existingSubstitution && (
        existingSubstitution.substituteTeacherId !== substituteTeacherId ||
        (existingSubstitution.reason || '') !== substitutionReason ||
        (existingSubstitution.notes || '') !== substitutionNotes
      );

      if (hasSubstitutionNow && !hadSubstitution) {
        try {
          await substitutionService.createSubstitution({
            lessonId: variables.id,
            originalTeacherId: formData.teacherId,
            substituteTeacherId: substituteTeacherId,
            reason: substitutionReason || undefined,
            notes: substitutionNotes || undefined,
          });
          queryClient.invalidateQueries({ queryKey: ['substitutions'] });
        } catch (error) {
          console.error('Error creating substitution:', error);
          toast.error('Lekcja zaktualizowana, ale wystąpił błąd przy tworzeniu zastępstwa');
        }
      } else if (hasSubstitutionNow && hadSubstitution && substitutionDataChanged) {
        try {
          await substitutionService.updateSubstitution(existingSubstitution.id, {
            substituteTeacherId: substituteTeacherId,
            reason: substitutionReason || undefined,
            notes: substitutionNotes || undefined,
          });
          queryClient.invalidateQueries({ queryKey: ['substitutions'] });
        } catch (error) {
          console.error('Error updating substitution:', error);
          toast.error('Lekcja zaktualizowana, ale wystąpił błąd przy aktualizacji zastępstwa');
        }
      } else if (!isSubstitution && hadSubstitution) {
        try {
          await substitutionService.deleteSubstitution(existingSubstitution.id);
          queryClient.invalidateQueries({ queryKey: ['substitutions'] });
        } catch (error) {
          console.error('Error deleting substitution:', error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['lessons'] });

      toast.success('Lekcja została pomyślnie zaktualizowana');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas aktualizacji lekcji';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => lessonService.updateLesson(lesson!.id, { status: 'COMPLETED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      toast.success('Lekcja oznaczona jako zakończona');
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Błąd przy oznaczaniu lekcji';
      toast.error(errorMessage);
    },
  });

  const handleCompleteLesson = () => {
    completeMutation.mutate();
  };

  const handleChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  const handlePriceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, pricePerLesson: value }));
    setPriceWasManuallySet(true);
  }, []);

  const toggleStudent = useCallback((studentId: string) => {
    setFormData(prev => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter(id => id !== studentId)
        : [...prev.studentIds, studentId]
    }));
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Tytuł lekcji jest wymagany';
    }

    if (!formData.teacherId) {
      newErrors.teacherId = 'Lektor jest wymagany';
    }

    if (formData.studentIds.length === 0) {
      newErrors.studentIds = 'Wybierz co najmniej jednego ucznia';
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

    if (!validate()) {
      if (errors.title || errors.deliveryMode) {
        setActiveTab('basic');
      } else if (errors.scheduledAt || errors.durationMinutes) {
        setActiveTab('schedule');
      } else if (errors.teacherId || errors.studentIds) {
        setActiveTab('participants');
      }
      return;
    }

    const lessonData: CreateLessonData = {
      courseId: formData.courseId || undefined,
      enrollmentId: undefined,
      teacherId: formData.teacherId,
      studentId: '',
      title: formData.title,
      description: formData.description || undefined,
      scheduledAt: formData.scheduledAt,
      durationMinutes: Number(formData.durationMinutes),
      pricePerLesson: formData.pricePerLesson ? Number(formData.pricePerLesson) : undefined,
      currency: formData.currency,
      deliveryMode: formData.deliveryMode,
      meetingUrl: formData.deliveryMode === 'ONLINE' ? formData.meetingUrl || undefined : undefined,
      locationId: formData.deliveryMode === 'IN_PERSON' ? formData.locationId || undefined : undefined,
      classroomId: formData.deliveryMode === 'IN_PERSON' ? formData.classroomId || undefined : undefined,
      status: formData.status as any,
    };

    if (isEdit && lesson) {
      updateMutation.mutate({
        id: lesson.id,
        updates: {
          ...lessonData,
          studentId: formData.studentIds[0],
          enrollmentId: lesson.enrollmentId,
        },
      });
    } else {
      if (isRecurring) {
        const scheduledDate = new Date(formData.scheduledAt);
        const endDate = new Date(scheduledDate);
        const dayOfWeek = scheduledDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

        if (recurringType === 'weeks') {
          endDate.setDate(endDate.getDate() + (Number(recurringCount) * 7));
        } else {
          endDate.setMonth(endDate.getMonth() + Number(recurringCount));
        }

        const pattern = {
          frequency: recurringType === 'weeks' ? 'WEEKLY' as const : 'MONTHLY' as const,
          interval: 1,
          startDate: formData.scheduledAt,
          endDate: endDate.toISOString(),
          daysOfWeek: recurringType === 'weeks' ? [dayOfWeek] : undefined,
          occurrencesCount: Number(recurringCount),
        };

        createRecurringMutation.mutate({
          lessonData,
          pattern,
          studentIds: formData.studentIds,
        });
      } else {
        createMutation.mutate({
          lessonData,
          studentIds: formData.studentIds,
        });
      }
    }
  };

  const createTabs = [
    { id: 'basic' as CreateTabType, name: 'Podstawowe informacje', icon: Info },
    { id: 'schedule' as CreateTabType, name: 'Harmonogram', icon: Clock },
    { id: 'participants' as CreateTabType, name: 'Uczestnicy', icon: UsersIcon },
  ];

  const editTabs = [
    { id: 'basic' as EditTabType, name: 'Podstawowe informacje', icon: Info },
    { id: 'schedule' as EditTabType, name: 'Harmonogram', icon: Clock },
    { id: 'participants' as EditTabType, name: 'Uczestnicy', icon: UsersIcon },
    { id: 'attendance' as EditTabType, name: 'Lista obecności', icon: ClipboardList },
  ];

  const tabs = isEdit ? editTabs : createTabs;

  // Get selected teacher for displaying rate info
  const selectedTeacher = teachers.find(t => t.id === formData.teacherId);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex gap-4 px-6 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {errors.form && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">{errors.form}</p>
                </div>
              )}

              {/* Tab: Podstawowe informacje */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
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
                          placeholder="np. Lekcja konwersacyjna"
                        />
                        {errors.title && (
                          <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                        )}
                      </div>
                      {/* Teacher */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
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
                              {teacher.hourlyRate ? ` (${teacher.hourlyRate} PLN/h)` : ''}
                            </option>
                          ))}
                        </select>
                        {errors.teacherId && (
                          <p className="mt-1 text-sm text-red-600">{errors.teacherId}</p>
                        )}
                      </div>

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
                  </div>

                  {/* Delivery Mode */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Sposób przeprowadzenia</h3>

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
                          placeholder="https://meet.google.com/..."
                        />
                        {errors.meetingUrl && (
                          <p className="mt-1 text-sm text-red-600">{errors.meetingUrl}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">Cena</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cena za lekcję
                        </label>
                        <input
                          type="number"
                          name="pricePerLesson"
                          value={formData.pricePerLesson}
                          onChange={handlePriceChange}
                          min="0"
                          step="0.01"
                          placeholder="Opcjonalnie"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        {!isEdit && !priceWasManuallySet && (
                          <p className="mt-1 text-xs text-gray-500">
                            {(() => {
                              const selectedCourse = courses.find(c => c.id === formData.courseId);
                              const courseTypePrice = selectedCourse?.courseType?.pricePerLesson;
                              if (formData.courseId && courseTypePrice) {
                                return `Cena na podstawie kursu "${selectedCourse?.courseType?.name}" (${courseTypePrice} ${formData.currency}/lekcję)`;
                              }
                              if (selectedTeacher?.hourlyRate) {
                                return `Sugerowana cena na podstawie stawki lektora (${selectedTeacher.hourlyRate} ${formData.currency}/h)`;
                              }
                              return null;
                            })()}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Waluta
                        </label>
                        <select
                          name="currency"
                          value={formData.currency}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="PLN">PLN (Polski złoty)</option>
                          <option value="USD">USD (Dolar amerykański)</option>
                          <option value="EUR">EUR (Euro)</option>
                          <option value="GBP">GBP (Funt brytyjski)</option>
                          <option value="CHF">CHF (Frank szwajcarski)</option>
                          <option value="CZK">CZK (Korona czeska)</option>
                          <option value="DKK">DKK (Korona duńska)</option>
                          <option value="NOK">NOK (Korona norweska)</option>
                          <option value="SEK">SEK (Korona szwedzka)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Harmonogram */}
              {activeTab === 'schedule' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  {/* Recurring Lessons - only show for new lessons */}
                  {!isEdit && (
                    <div className="pt-4 border-t border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isRecurring}
                          onChange={(e) => setIsRecurring(e.target.checked)}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-sm font-medium text-gray-700">Utwórz serię lekcji</span>
                      </label>

                      {isRecurring && (
                        <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="grid grid-cols-2 gap-4">
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
                </div>
              )}

              {/* Tab: Uczestnicy */}
              {activeTab === 'participants' && (
                <div className="space-y-4">
                  {/* Substitution checkbox (only in edit mode) */}
                  {isEdit && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSubstitution}
                          onChange={(e) => {
                            setIsSubstitution(e.target.checked);
                            if (!e.target.checked) {
                              setSubstituteTeacherId('');
                              setSubstitutionReason('');
                              setSubstitutionNotes('');
                            }
                          }}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                        />
                        <span className="ml-2 text-sm font-medium text-amber-900">
                          To jest zastępstwo
                        </span>
                      </label>

                      {isSubstitution && (
                        <div className="mt-4 space-y-3">
                          <p className="text-xs text-amber-700 mb-2">
                            Lektor wybrany powyżej ({teachers.find(t => t.id === formData.teacherId)?.user.firstName} {teachers.find(t => t.id === formData.teacherId)?.user.lastName}) zostanie zapisany jako pierwotny lektor.
                          </p>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Lektor zastępczy *
                            </label>
                            <select
                              value={substituteTeacherId}
                              onChange={(e) => setSubstituteTeacherId(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            >
                              <option value="">Wybierz lektora zastępczego</option>
                              {teachers
                                .filter(t => t.id !== formData.teacherId)
                                .map((teacher) => (
                                  <option key={teacher.id} value={teacher.id}>
                                    {teacher.user.firstName} {teacher.user.lastName}
                                  </option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Powód zastępstwa
                            </label>
                            <input
                              type="text"
                              value={substitutionReason}
                              onChange={(e) => setSubstitutionReason(e.target.value)}
                              placeholder="np. choroba, urlop"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Notatki
                            </label>
                            <textarea
                              value={substitutionNotes}
                              onChange={(e) => setSubstitutionNotes(e.target.value)}
                              placeholder="Dodatkowe informacje..."
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Course (optional) */}
                  {!isEdit && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kurs (opcjonalnie)
                      </label>
                      <select
                        name="courseId"
                        value={formData.courseId}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Wybierz kurs (załaduje uczniów z kursu)</option>
                        {courses.map((course) => (
                          <option key={course.id} value={course.id}>
                            {course.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Wybranie kursu automatycznie załaduje uczniów zapisanych na ten kurs
                      </p>
                    </div>
                  )}

                  {/* Students List */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Uczniowie * {!isEdit && `(${formData.studentIds.length} wybranych)`}
                    </label>

                    {isEdit ? (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-700">
                          {lesson?.student?.user.firstName} {lesson?.student?.user.lastName}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          W trybie edycji nie można zmienić ucznia
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg">
                        {students.length === 0 ? (
                          <div className="p-4 text-center text-gray-500">
                            Brak uczniów w szkole
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-200">
                            {students.map((student) => (
                              <label
                                key={student.id}
                                className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.studentIds.includes(student.id)}
                                  onChange={() => toggleStudent(student.id)}
                                  className="w-4 h-4 text-primary focus:ring-primary rounded"
                                />
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {student.user.firstName} {student.user.lastName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {student.user.email}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {errors.studentIds && (
                      <p className="mt-1 text-sm text-red-600">{errors.studentIds}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Lista obecności (only for edit mode) */}
              {activeTab === 'attendance' && isEdit && lesson && (
                <AttendanceSection lesson={lesson} />
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Zamknij
                </button>
                {isEdit && lesson && lesson.status !== 'CANCELLED' && lesson.status !== 'COMPLETED' && (
                  <button
                    type="button"
                    onClick={() => setIsCancelDialogOpen(true)}
                    className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Anuluj lekcję
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {isEdit && lesson && (lesson.status === 'SCHEDULED' || lesson.status === 'CONFIRMED') && (
                  <button
                    type="button"
                    onClick={handleCompleteLesson}
                    disabled={updateMutation.isPending || completeMutation.isPending}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {completeMutation.isPending ? 'Oznaczanie...' : 'Oznacz jako zakończoną'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={createMutation.isPending || createRecurringMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createMutation.isPending || createRecurringMutation.isPending || updateMutation.isPending
                    ? 'Zapisywanie...'
                    : isEdit
                    ? 'Zapisz zmiany'
                    : 'Utwórz lekcję'}
                </button>
              </div>
            </div>
          </form>

          {/* Cancel Lesson Dialog */}
          {lesson && (
            <CancelLessonDialog
              lesson={lesson}
              isOpen={isCancelDialogOpen}
              onClose={() => setIsCancelDialogOpen(false)}
              onSuccess={() => {
                setIsCancelDialogOpen(false);
                onSuccess();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LessonModal;
