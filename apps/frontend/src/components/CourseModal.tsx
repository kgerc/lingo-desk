import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { courseService, Course, CreateCourseWithScheduleData, ScheduleItem, SchedulePattern } from '../services/courseService';
import { teacherService } from '../services/teacherService';
import { studentService } from '../services/studentService';
import { X, Info, Calendar, Users, Plus, Trash2, Clock, AlertCircle, Settings } from 'lucide-react';
import { handleApiError } from '../lib/errorUtils';

interface CourseModalProps {
  course: Course | null;
  isCopy?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type TabType = 'basic' | 'details' | 'schedule' | 'students';
type ScheduleMode = 'none' | 'manual' | 'recurring';

// Mapping of form field names to their respective tabs
const FIELD_TO_TAB_MAP: Record<string, TabType> = {
  // Basic tab fields
  name: 'basic',
  courseType: 'basic',
  teacherId: 'basic',
  language: 'basic',
  level: 'basic',
  startDate: 'basic',
  endDate: 'basic',
  isActive: 'basic',
  // Details tab fields
  deliveryMode: 'details',
  defaultDurationMinutes: 'details',
  maxStudents: 'details',
  pricePerLesson: 'details',
  currency: 'details',
  description: 'details',
  // Students tab fields
  students: 'students',
  // Schedule tab fields
  schedule: 'schedule',
};

const DAYS_OF_WEEK = [
  { value: 1, label: 'Poniedziałek' },
  { value: 2, label: 'Wtorek' },
  { value: 3, label: 'Środa' },
  { value: 4, label: 'Czwartek' },
  { value: 5, label: 'Piątek' },
  { value: 6, label: 'Sobota' },
  { value: 0, label: 'Niedziela' },
];

const LANGUAGES = [
  { value: 'en', label: 'Angielski' },
  { value: 'de', label: 'Niemiecki' },
  { value: 'es', label: 'Hiszpański' },
  { value: 'fr', label: 'Francuski' },
  { value: 'it', label: 'Włoski' },
  { value: 'pl', label: 'Polski' },
];

const LEVELS = [
  { value: 'A0', label: 'A0 (Od zera)' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
  { value: 'BEGINNER', label: 'Początkujący' },
  { value: 'INTERMEDIATE', label: 'Średniozaawansowany' },
  { value: 'ADVANCED', label: 'Zaawansowany' },
  { value: 'ALL_LEVELS', label: 'Wszystkie poziomy' },
];

const CURRENCIES = [
  { value: 'PLN', label: 'PLN' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD', label: 'USD' },
  { value: 'GBP', label: 'GBP' },
];

const CourseModal: React.FC<CourseModalProps> = ({ course, isCopy, onClose, onSuccess }) => {
  const isEdit = !!course && !isCopy;

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [formData, setFormData] = useState({
    teacherId: course?.teacherId || '',
    name: course?.name || '',
    // Pola przeniesione z CourseType:
    courseType: course?.courseType || 'INDIVIDUAL' as 'GROUP' | 'INDIVIDUAL',
    language: course?.language || 'en',
    level: course?.level || 'A1',
    deliveryMode: course?.deliveryMode || 'ONLINE' as 'IN_PERSON' | 'ONLINE' | 'BOTH',
    defaultDurationMinutes: course?.defaultDurationMinutes?.toString() || '60',
    pricePerLesson: course?.pricePerLesson?.toString() || '',
    currency: course?.currency || 'PLN',
    description: course?.description || '',
    // Pozostałe pola:
    maxStudents: course?.maxStudents?.toString() || '',
    startDate: course?.startDate ? course.startDate.split('T')[0] : '',
    endDate: course?.endDate ? course.endDate.split('T')[0] : '',
    isActive: course?.isActive ?? true,
  });

  // Schedule state
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('none');
  const [manualItems, setManualItems] = useState<ScheduleItem[]>([]);
  const [recurringPattern, setRecurringPattern] = useState<SchedulePattern>({
    frequency: 'WEEKLY',
    startDate: '',
    endDate: '',
    occurrencesCount: 10,
    daySchedules: [], // New format: each day has its own time
    durationMinutes: 60,
    deliveryMode: 'IN_PERSON',
    meetingUrl: '',
  });

  // Selected students for enrollment
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate errors per tab
  const tabErrors = useMemo(() => {
    const counts: Record<TabType, number> = {
      basic: 0,
      details: 0,
      students: 0,
      schedule: 0,
    };

    Object.keys(errors).forEach((field) => {
      if (errors[field]) {
        const tab = FIELD_TO_TAB_MAP[field];
        if (tab) {
          counts[tab]++;
        }
      }
    });

    return counts;
  }, [errors]);

  // Fetch teachers for dropdown
  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => teacherService.getTeachers({ isActive: true }),
  });

  // Fetch students for selection
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents({ isActive: true }),
  });

  // Generate preview of lessons from recurring pattern (using new daySchedules format)
  const previewLessons = useMemo(() => {
    if (scheduleMode !== 'recurring' || !recurringPattern.startDate) {
      return [];
    }

    // Need at least one day selected with time
    const daySchedules = recurringPattern.daySchedules || [];
    if (daySchedules.length === 0) {
      return [];
    }

    const lessons: Date[] = [];
    const startDate = new Date(recurringPattern.startDate);
    const maxOccurrences = recurringPattern.occurrencesCount || 52;
    const endDate = recurringPattern.endDate ? new Date(recurringPattern.endDate) : null;

    // For MONTHLY frequency, use first day's time
    if (recurringPattern.frequency === 'MONTHLY') {
      const [hours, minutes] = (daySchedules[0]?.time || '09:00').split(':').map(Number);
      let currentDate = new Date(startDate);
      currentDate.setHours(hours, minutes, 0, 0);

      while (lessons.length < maxOccurrences && (!endDate || currentDate <= endDate)) {
        lessons.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      return lessons.slice(0, 20);
    }

    const weekInterval = recurringPattern.frequency === 'BIWEEKLY' ? 2 : 1;
    const maxWeeks = Math.ceil(maxOccurrences / Math.max(daySchedules.length, 1)) + 1;

    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    let weekCount = 0;
    while (weekCount < maxWeeks && lessons.length < maxOccurrences) {
      // Sort by day of week
      for (const daySchedule of [...daySchedules].sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
        const [hours, minutes] = daySchedule.time.split(':').map(Number);
        const lessonDate = new Date(weekStart);
        lessonDate.setDate(lessonDate.getDate() + daySchedule.dayOfWeek);
        lessonDate.setHours(hours, minutes, 0, 0);

        if (lessonDate < startDate) continue;
        if (endDate && lessonDate > endDate) break;
        if (lessons.length >= maxOccurrences) break;

        lessons.push(new Date(lessonDate));
      }

      weekStart.setDate(weekStart.getDate() + 7 * weekInterval);
      weekCount++;
    }

    return lessons.slice(0, 20);
  }, [scheduleMode, recurringPattern]);

  const createMutation = useMutation({
    mutationFn: (data: CreateCourseWithScheduleData) => courseService.createCourseWithSchedule(data),
    onSuccess: (result) => {
      if (result.lessonsCreated > 0) {
        toast.success(`Kurs został utworzony z ${result.lessonsCreated} lekcjami`);
      } else {
        toast.success('Kurs został pomyślnie utworzony');
      }
      if (result.errors && result.errors.length > 0) {
        toast.error(`Niektóre lekcje nie zostały utworzone (${result.errors.length} błędów)`);
      }
      onSuccess();
    },
    onError: (error: any) => {
      const { fieldErrors, message } = handleApiError(error, 'Wystąpił błąd podczas tworzenia kursu');
      toast.error(message);
      setErrors(fieldErrors);
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
      const { fieldErrors, message } = handleApiError(error, 'Wystąpił błąd podczas aktualizacji kursu');
      toast.error(message);
      setErrors(fieldErrors);
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

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handlePatternChange = (field: keyof SchedulePattern, value: any) => {
    setRecurringPattern(prev => ({ ...prev, [field]: value }));
  };

  // Toggle day selection - adds/removes day with default time
  const handleDayToggle = (day: number) => {
    setRecurringPattern(prev => {
      const current = prev.daySchedules || [];
      const existingIndex = current.findIndex(d => d.dayOfWeek === day);

      if (existingIndex >= 0) {
        // Remove day
        return { ...prev, daySchedules: current.filter(d => d.dayOfWeek !== day) };
      } else {
        // Add day with default time 09:00
        return {
          ...prev,
          daySchedules: [...current, { dayOfWeek: day, time: '09:00' }].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        };
      }
    });
  };

  // Update time for a specific day
  const handleDayTimeChange = (day: number, time: string) => {
    setRecurringPattern(prev => {
      const current = prev.daySchedules || [];
      return {
        ...prev,
        daySchedules: current.map(d => d.dayOfWeek === day ? { ...d, time } : d)
      };
    });
  };

  // Get time for a specific day (for input value)
  const getDayTime = (day: number): string => {
    const daySchedule = recurringPattern.daySchedules?.find(d => d.dayOfWeek === day);
    return daySchedule?.time || '09:00';
  };

  // Check if day is selected
  const isDaySelected = (day: number): boolean => {
    return recurringPattern.daySchedules?.some(d => d.dayOfWeek === day) || false;
  };

  const addManualItem = () => {
    const defaultDuration = parseInt(formData.defaultDurationMinutes) || 60;
    setManualItems(prev => [...prev, {
      scheduledAt: '',
      durationMinutes: defaultDuration,
      deliveryMode: 'IN_PERSON',
    }]);
  };

  const updateManualItem = (index: number, field: keyof ScheduleItem, value: any) => {
    setManualItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeManualItem = (index: number) => {
    setManualItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa kursu jest wymagana';
    }

    if (!formData.teacherId) {
      newErrors.teacherId = 'Lektor jest wymagany';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Data rozpoczęcia jest wymagana';
    }

    if (!formData.pricePerLesson || parseFloat(formData.pricePerLesson) < 0) {
      newErrors.pricePerLesson = 'Podaj cenę za lekcję';
    }

    if (formData.maxStudents && parseInt(formData.maxStudents) <= 0) {
      newErrors.maxStudents = 'Maksymalna liczba uczestników musi być większa od 0';
    }

    if (formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      newErrors.endDate = 'Data zakończenia nie może być wcześniejsza niż data rozpoczęcia';
    }

    if (!isEdit && scheduleMode !== 'none' && selectedStudentIds.length === 0) {
      newErrors.students = 'Wybierz co najmniej jednego ucznia, aby utworzyć harmonogram lekcji';
    }

    if (scheduleMode === 'recurring') {
      if (!recurringPattern.startDate) {
        newErrors.schedule = 'Podaj datę rozpoczęcia harmonogramu';
      }
      // For WEEKLY/BIWEEKLY, require at least one day with time
      if ((recurringPattern.frequency === 'WEEKLY' || recurringPattern.frequency === 'BIWEEKLY') &&
          (!recurringPattern.daySchedules || recurringPattern.daySchedules.length === 0)) {
        newErrors.schedule = 'Wybierz co najmniej jeden dzień tygodnia z godziną zajęć';
      }
    }

    if (scheduleMode === 'manual' && manualItems.length === 0) {
      newErrors.schedule = 'Dodaj co najmniej jedną lekcję do harmonogramu';
    }

    setErrors(newErrors);

    // Auto-navigate to first tab with error
    if (Object.keys(newErrors).length > 0) {
      const tabOrder: TabType[] = ['basic', 'details', 'students', 'schedule'];
      for (const tab of tabOrder) {
        const hasErrorInTab = Object.keys(newErrors).some(
          (field) => FIELD_TO_TAB_MAP[field] === tab
        );
        if (hasErrorInTab) {
          // Only switch if the tab is available (schedule/students only in create mode)
          const isTabAvailable = tab === 'basic' || tab === 'details' || !isEdit;
          if (isTabAvailable) {
            setActiveTab(tab);
            break;
          }
        }
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const data: any = {
      teacherId: formData.teacherId,
      name: formData.name,
      courseType: formData.courseType,
      language: formData.language,
      level: formData.level,
      deliveryMode: formData.deliveryMode,
      defaultDurationMinutes: parseInt(formData.defaultDurationMinutes) || 60,
      pricePerLesson: parseFloat(formData.pricePerLesson) || 0,
      currency: formData.currency,
      description: formData.description || undefined,
      startDate: formData.startDate,
      endDate: formData.endDate || undefined,
      maxStudents: formData.maxStudents ? parseInt(formData.maxStudents) : undefined,
      isActive: formData.isActive,
    };

    if (isEdit && course) {
      await updateMutation.mutateAsync({ id: course.id, updates: data });
    } else {
      const scheduleData: CreateCourseWithScheduleData = {
        ...data,
        studentIds: selectedStudentIds.length > 0 ? selectedStudentIds : undefined,
      };

      if (scheduleMode === 'manual' && manualItems.length > 0) {
        scheduleData.schedule = { items: manualItems };
      } else if (scheduleMode === 'recurring') {
        scheduleData.schedule = { pattern: recurringPattern };
      }

      await createMutation.mutateAsync(scheduleData);
    }
  };

  const tabs = [
    { id: 'basic' as TabType, name: 'Podstawowe', icon: Info },
    { id: 'details' as TabType, name: 'Szczegóły', icon: Settings },
    ...(!isEdit ? [
      { id: 'students' as TabType, name: 'Uczniowie', icon: Users },
      { id: 'schedule' as TabType, name: 'Harmonogram', icon: Calendar },
    ] : []),
  ];

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pl-PL', {
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edytuj kurs' : isCopy ? 'Kopiuj kurs (nowy)' : 'Dodaj nowy kurs'}
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
              const errorCount = tabErrors[tab.id] || 0;
              const hasErrors = errorCount > 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    isActive
                      ? hasErrors
                        ? 'border-red-500 text-red-600'
                        : 'border-primary text-primary'
                      : hasErrors
                        ? 'border-transparent text-red-500 hover:text-red-600 hover:border-red-300'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {hasErrors ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                  {tab.name}
                  {hasErrors && (
                    <span className="ml-1 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                      {errorCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {errors.form}
            </div>
          )}

          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Podstawowe informacje</h3>

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

                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Typ kursu *
                  </label>
                  <select
                    name="courseType"
                    value={formData.courseType}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="INDIVIDUAL">Indywidualny</option>
                    <option value="GROUP">Grupowy</option>
                  </select>
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

                {/* Language & Level */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Język *
                    </label>
                    <select
                      name="language"
                      value={formData.language}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {LANGUAGES.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Poziom *
                    </label>
                    <select
                      name="level"
                      value={formData.level}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div>
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
              </div>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Szczegóły kursu</h3>

                {/* Delivery Mode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tryb prowadzenia *
                  </label>
                  <select
                    name="deliveryMode"
                    value={formData.deliveryMode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ONLINE">Online</option>
                    <option value="IN_PERSON">Stacjonarnie</option>
                    <option value="BOTH">Oba tryby</option>
                  </select>
                </div>

                {/* Duration & Max Students */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Domyślny czas lekcji (minuty) *
                    </label>
                    <input
                      type="number"
                      name="defaultDurationMinutes"
                      value={formData.defaultDurationMinutes}
                      onChange={handleChange}
                      min="15"
                      step="15"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

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
                </div>

                {/* Price & Currency */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cena za lekcję *
                    </label>
                    <input
                      type="number"
                      name="pricePerLesson"
                      value={formData.pricePerLesson}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                        errors.pricePerLesson ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="np. 100"
                    />
                    {errors.pricePerLesson && (
                      <p className="mt-1 text-sm text-red-600">{errors.pricePerLesson}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Waluta *
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {CURRENCIES.map((curr) => (
                        <option key={curr.value} value={curr.value}>
                          {curr.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opis kursu
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Opcjonalny opis kursu..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && !isEdit && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Wybierz uczniów do kursu</h3>
                <span className="text-sm text-gray-500">
                  Wybrano: {selectedStudentIds.length}
                </span>
              </div>

              {errors.students && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  {errors.students}
                </div>
              )}

              <div className="text-sm text-gray-500 mb-4">
                Wybrani uczniowie zostaną automatycznie zapisani do kursu i będą mieli tworzone lekcje zgodnie z harmonogramem.
              </div>

              <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                {students.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Brak dostępnych uczniów
                  </div>
                ) : (
                  students.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {student.user.firstName} {student.user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{student.user.email}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && !isEdit && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Harmonogram lekcji</h3>

              {/* Schedule Mode Selection */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleMode"
                    checked={scheduleMode === 'none'}
                    onChange={() => setScheduleMode('none')}
                    className="text-primary"
                  />
                  <span>Bez harmonogramu</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleMode"
                    checked={scheduleMode === 'manual'}
                    onChange={() => setScheduleMode('manual')}
                    className="text-primary"
                  />
                  <span>Pojedyncze daty</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleMode"
                    checked={scheduleMode === 'recurring'}
                    onChange={() => setScheduleMode('recurring')}
                    className="text-primary"
                  />
                  <span>Lekcje cykliczne</span>
                </label>
              </div>

              {errors.schedule && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {errors.schedule}
                </div>
              )}

              {/* Manual Schedule */}
              {scheduleMode === 'manual' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Pojedyncze lekcje</h4>
                    <button
                      type="button"
                      onClick={addManualItem}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
                    >
                      <Plus className="h-4 w-4" />
                      Dodaj lekcję
                    </button>
                  </div>

                  {manualItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                      Kliknij "Dodaj lekcję", aby dodać pojedyncze terminy
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {manualItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <input
                            type="datetime-local"
                            value={item.scheduledAt}
                            onChange={(e) => updateManualItem(index, 'scheduledAt', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          />
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <input
                              type="number"
                              value={item.durationMinutes}
                              onChange={(e) => updateManualItem(index, 'durationMinutes', Number(e.target.value))}
                              min="15"
                              step="15"
                              className="w-20 px-2 py-2 border border-gray-300 rounded-lg"
                            />
                            <span className="text-sm text-gray-500">min</span>
                          </div>
                          <select
                            value={item.deliveryMode}
                            onChange={(e) => updateManualItem(index, 'deliveryMode', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            <option value="IN_PERSON">Stacjonarnie</option>
                            <option value="ONLINE">Online</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeManualItem(index)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recurring Schedule */}
              {scheduleMode === 'recurring' && (
                <div className="space-y-4">
                  <h4 className="font-medium">Lekcje cykliczne</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Częstotliwość
                      </label>
                      <select
                        value={recurringPattern.frequency}
                        onChange={(e) => handlePatternChange('frequency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="WEEKLY">Co tydzień</option>
                        <option value="BIWEEKLY">Co dwa tygodnie</option>
                        <option value="MONTHLY">Co miesiąc</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Czas trwania (minuty)
                      </label>
                      <input
                        type="number"
                        value={recurringPattern.durationMinutes}
                        onChange={(e) => handlePatternChange('durationMinutes', Number(e.target.value))}
                        min="15"
                        step="15"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data rozpoczęcia *
                      </label>
                      <input
                        type="date"
                        value={recurringPattern.startDate}
                        onChange={(e) => handlePatternChange('startDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data zakończenia (opcjonalnie)
                      </label>
                      <input
                        type="date"
                        value={recurringPattern.endDate || ''}
                        onChange={(e) => handlePatternChange('endDate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Liczba lekcji
                      </label>
                      <input
                        type="number"
                        value={recurringPattern.occurrencesCount || ''}
                        onChange={(e) => handlePatternChange('occurrencesCount', Number(e.target.value) || undefined)}
                        min="1"
                        max="52"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="np. 10"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tryb zajęć
                      </label>
                      <select
                        value={recurringPattern.deliveryMode}
                        onChange={(e) => handlePatternChange('deliveryMode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="IN_PERSON">Stacjonarnie</option>
                        <option value="ONLINE">Online</option>
                      </select>
                    </div>
                  </div>

                  {/* Days of week with individual times */}
                  {(recurringPattern.frequency === 'WEEKLY' || recurringPattern.frequency === 'BIWEEKLY') && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Dni tygodnia i godziny zajęć *
                      </label>
                      <p className="text-sm text-gray-500 mb-3">
                        Wybierz dni i ustaw godzinę dla każdego dnia osobno
                      </p>
                      <div className="space-y-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <div
                            key={day.value}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              isDaySelected(day.value)
                                ? 'bg-primary/5 border-primary/30'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`day-${day.value}`}
                              checked={isDaySelected(day.value)}
                              onChange={() => handleDayToggle(day.value)}
                              className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                            />
                            <label
                              htmlFor={`day-${day.value}`}
                              className="flex-1 text-sm font-medium text-gray-700 cursor-pointer"
                            >
                              {day.label}
                            </label>
                            {isDaySelected(day.value) && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                <input
                                  type="time"
                                  value={getDayTime(day.value)}
                                  onChange={(e) => handleDayTimeChange(day.value, e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {(recurringPattern.daySchedules?.length || 0) === 0 && (
                        <p className="mt-2 text-sm text-amber-600">
                          Wybierz co najmniej jeden dzień tygodnia
                        </p>
                      )}
                    </div>
                  )}

                  {previewLessons.length > 0 && (
                    <div className="mt-6">
                      <h4 className="font-medium mb-2">
                        Podgląd ({previewLessons.length} lekcji{previewLessons.length >= 20 ? ' - pokazano pierwsze 20' : ''})
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                          {previewLessons.map((date, index) => (
                            <div key={index} className="text-gray-600">
                              {formatDate(date)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {scheduleMode !== 'none' && selectedStudentIds.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">Podsumowanie</p>
                      <p>
                        Zostanie utworzonych{' '}
                        <strong>
                          {scheduleMode === 'manual'
                            ? manualItems.length * selectedStudentIds.length
                            : previewLessons.length * selectedStudentIds.length}
                        </strong>{' '}
                        lekcji dla <strong>{selectedStudentIds.length}</strong> uczniów.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSubmit}
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
      </div>
    </div>
  );
};

export default CourseModal;
