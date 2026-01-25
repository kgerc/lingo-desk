import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { courseService, Course, CreateCourseWithScheduleData, ScheduleItem, SchedulePattern } from '../services/courseService';
import { teacherService } from '../services/teacherService';
import { studentService } from '../services/studentService';
import { courseTypeService } from '../services/courseTypeService';
import { X, Info, Calendar, Users, Plus, Trash2, Clock, AlertCircle } from 'lucide-react';

interface CourseModalProps {
  course: Course | null;
  onClose: () => void;
  onSuccess: () => void;
}

type TabType = 'basic' | 'schedule' | 'students';
type ScheduleMode = 'none' | 'manual' | 'recurring';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Poniedziałek' },
  { value: 2, label: 'Wtorek' },
  { value: 3, label: 'Środa' },
  { value: 4, label: 'Czwartek' },
  { value: 5, label: 'Piątek' },
  { value: 6, label: 'Sobota' },
  { value: 0, label: 'Niedziela' },
];

const CourseModal: React.FC<CourseModalProps> = ({ course, onClose, onSuccess }) => {
  const isEdit = !!course;

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [formData, setFormData] = useState({
    courseTypeId: course?.courseTypeId || '',
    teacherId: course?.teacherId || '',
    name: course?.name || '',
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
    daysOfWeek: [],
    time: '09:00',
    durationMinutes: 60,
    deliveryMode: 'IN_PERSON',
    meetingUrl: '',
  });

  // Selected students for enrollment
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Fetch course types for dropdown
  const { data: courseTypes = [] } = useQuery({
    queryKey: ['courseTypes'],
    queryFn: () => courseTypeService.getCourseTypes(),
  });

  // Get selected course type for default duration
  const selectedCourseType = useMemo(() => {
    return courseTypes.find(ct => ct.id === formData.courseTypeId);
  }, [courseTypes, formData.courseTypeId]);

  // Generate preview of lessons from recurring pattern
  const previewLessons = useMemo(() => {
    if (scheduleMode !== 'recurring' || !recurringPattern.startDate || !recurringPattern.time) {
      return [];
    }

    const lessons: Date[] = [];
    const [hours, minutes] = recurringPattern.time.split(':').map(Number);
    const startDate = new Date(recurringPattern.startDate);
    startDate.setHours(hours, minutes, 0, 0);

    const maxOccurrences = recurringPattern.occurrencesCount || 52;
    const effectiveDaysOfWeek = recurringPattern.daysOfWeek && recurringPattern.daysOfWeek.length > 0
      ? recurringPattern.daysOfWeek
      : [startDate.getDay()];
    const endDate = recurringPattern.endDate ? new Date(recurringPattern.endDate) : null;

    // For MONTHLY frequency, use simpler logic
    if (recurringPattern.frequency === 'MONTHLY') {
      let currentDate = new Date(startDate);
      while (lessons.length < maxOccurrences && (!endDate || currentDate <= endDate)) {
        lessons.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      return lessons.slice(0, 20);
    }

    // For WEEKLY/BIWEEKLY with multiple days, iterate week by week
    const weekInterval = recurringPattern.frequency === 'BIWEEKLY' ? 2 : 1;
    const maxWeeks = Math.ceil(maxOccurrences / Math.max(effectiveDaysOfWeek.length, 1)) + 1;

    // Find the start of the week containing startDate (Sunday = 0)
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(hours, minutes, 0, 0);

    let weekCount = 0;
    while (weekCount < maxWeeks && lessons.length < maxOccurrences) {
      // Check each selected day of this week
      for (const dayOfWeek of [...effectiveDaysOfWeek].sort((a, b) => a - b)) {
        const lessonDate = new Date(weekStart);
        lessonDate.setDate(lessonDate.getDate() + dayOfWeek);
        lessonDate.setHours(hours, minutes, 0, 0);

        // Skip if before start date
        if (lessonDate < startDate) continue;

        // Stop if after end date
        if (endDate && lessonDate > endDate) break;

        // Stop if we have enough occurrences
        if (lessons.length >= maxOccurrences) break;

        lessons.push(new Date(lessonDate));
      }

      // Move to next week (or skip a week for BIWEEKLY)
      weekStart.setDate(weekStart.getDate() + 7 * weekInterval);
      weekCount++;
    }

    return lessons.slice(0, 20); // Show max 20 in preview
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

  const handlePatternChange = (field: keyof SchedulePattern, value: any) => {
    setRecurringPattern(prev => ({ ...prev, [field]: value }));
  };

  const handleDayOfWeekToggle = (day: number) => {
    setRecurringPattern(prev => {
      const current = prev.daysOfWeek || [];
      if (current.includes(day)) {
        return { ...prev, daysOfWeek: current.filter(d => d !== day) };
      } else {
        return { ...prev, daysOfWeek: [...current, day].sort() };
      }
    });
  };

  const addManualItem = () => {
    const defaultDuration = selectedCourseType?.defaultDurationMinutes || 60;
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

    // Validate schedule if adding lessons
    if (!isEdit && scheduleMode !== 'none' && selectedStudentIds.length === 0) {
      newErrors.students = 'Wybierz co najmniej jednego ucznia, aby utworzyć harmonogram lekcji';
    }

    if (scheduleMode === 'recurring' && !recurringPattern.startDate) {
      newErrors.schedule = 'Podaj datę rozpoczęcia harmonogramu';
    }

    if (scheduleMode === 'manual' && manualItems.length === 0) {
      newErrors.schedule = 'Dodaj co najmniej jedną lekcję do harmonogramu';
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
      // Add schedule data for new courses
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
            {isEdit ? 'Edytuj kurs' : 'Dodaj nowy kurs'}
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
                  onClick={() => setActiveTab(tab.id)}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {errors.form}
            </div>
          )}

          {/* Basic Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
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
                    {/* Frequency */}
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

                    {/* Duration */}
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

                    {/* Start Date */}
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

                    {/* Time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Godzina
                      </label>
                      <input
                        type="time"
                        value={recurringPattern.time}
                        onChange={(e) => handlePatternChange('time', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    {/* End Date or Count */}
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

                    {/* Delivery Mode */}
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

                  {/* Days of Week (for WEEKLY/BIWEEKLY) */}
                  {(recurringPattern.frequency === 'WEEKLY' || recurringPattern.frequency === 'BIWEEKLY') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dni tygodnia (opcjonalnie - domyślnie dzień z daty rozpoczęcia)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => handleDayOfWeekToggle(day.value)}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              recurringPattern.daysOfWeek?.includes(day.value)
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview */}
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

              {/* Summary */}
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
