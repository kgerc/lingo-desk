import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { teacherService } from '../services/teacherService';
import teacherScheduleService, { AvailabilityException, CreateAvailabilityException, TeacherPreferences, UpdateTeacherPreferences } from '../services/teacherScheduleService';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { Calendar, Plus, Trash2, AlertCircle, Clock, Settings } from 'lucide-react';

interface TimeSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Poniedziałek' },
  { value: 2, label: 'Wtorek' },
  { value: 3, label: 'Środa' },
  { value: 4, label: 'Czwartek' },
  { value: 5, label: 'Piątek' },
  { value: 6, label: 'Sobota' },
  { value: 0, label: 'Niedziela' },
];

const TeacherAvailabilityPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [editingSlots, setEditingSlots] = useState<TimeSlot[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Blackout dates state
  const [showAddException, setShowAddException] = useState(false);
  const [exceptionForm, setExceptionForm] = useState<CreateAvailabilityException>({
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; exceptionId: string | null }>({
    isOpen: false,
    exceptionId: null,
  });

  // Preferences state
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferencesForm, setPreferencesForm] = useState<UpdateTeacherPreferences>({
    timezone: 'Europe/Warsaw',
    prepTimeMinutes: 0,
    maxLessonsPerDay: undefined,
    minBreakBetweenMinutes: 0,
  });

  // Fetch current teacher's data
  const { data: teacher, isLoading: isLoadingTeacher } = useQuery({
    queryKey: ['currentTeacher'],
    queryFn: () => teacherService.getMe(),
    enabled: !!user?.id,
  });

  const teacherId = teacher?.id || '';

  // Fetch availability exceptions
  const { data: exceptions = [], isLoading: isLoadingExceptions } = useQuery({
    queryKey: ['availability-exceptions', teacherId],
    queryFn: () => teacherScheduleService.getAvailabilityExceptions(teacherId),
    enabled: !!teacherId,
  });

  // Fetch teacher preferences
  const { data: preferences, isLoading: isLoadingPreferences } = useQuery({
    queryKey: ['teacher-preferences', teacherId],
    queryFn: () => teacherScheduleService.getPreferences(teacherId),
    enabled: !!teacherId,
    onSuccess: (data: TeacherPreferences) => {
      if (data) {
        setPreferencesForm({
          timezone: data.timezone,
          prepTimeMinutes: data.prepTimeMinutes,
          maxLessonsPerDay: data.maxLessonsPerDay || undefined,
          minBreakBetweenMinutes: data.minBreakBetweenMinutes,
        });
      }
    },
  });

  // Update availability mutation
  const updateAvailabilityMutation = useMutation({
    mutationFn: (availability: TimeSlot[]) =>
      teacherService.setAvailability(teacherId, availability),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher', teacherId] });
      toast.success('Dostępność została zaktualizowana');
      setIsEditMode(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd aktualizacji dostępności');
    },
  });

  // Add exception mutation
  const addExceptionMutation = useMutation({
    mutationFn: (exception: CreateAvailabilityException) =>
      teacherScheduleService.addAvailabilityException(teacherId, exception),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-exceptions', teacherId] });
      toast.success('Wyjątek został dodany');
      setShowAddException(false);
      setExceptionForm({ startDate: '', endDate: '', reason: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd dodawania wyjątku');
    },
  });

  // Delete exception mutation
  const deleteExceptionMutation = useMutation({
    mutationFn: (exceptionId: string) =>
      teacherScheduleService.deleteAvailabilityException(teacherId, exceptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-exceptions', teacherId] });
      toast.success('Wyjątek został usunięty');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania wyjątku');
    },
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (prefs: UpdateTeacherPreferences) =>
      teacherScheduleService.updatePreferences(teacherId, prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-preferences', teacherId] });
      toast.success('Preferencje zostały zaktualizowane');
      setShowPreferences(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd aktualizacji preferencji');
    },
  });

  const handleEditMode = () => {
    setEditingSlots(teacher?.availability || []);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditingSlots([]);
  };

  const handleSaveAvailability = () => {
    updateAvailabilityMutation.mutate(editingSlots);
  };

  const handleAddSlot = (dayOfWeek: number) => {
    const newSlot: TimeSlot = {
      dayOfWeek,
      startTime: '09:00',
      endTime: '17:00',
    };
    setEditingSlots([...editingSlots, newSlot]);
  };

  const handleRemoveSlot = (index: number) => {
    setEditingSlots(editingSlots.filter((_, i) => i !== index));
  };

  const handleSlotChange = (index: number, field: keyof TimeSlot, value: string | number) => {
    const updated = [...editingSlots];
    updated[index] = { ...updated[index], [field]: value };
    setEditingSlots(updated);
  };

  const handleAddException = () => {
    if (!exceptionForm.startDate || !exceptionForm.endDate) {
      toast.error('Wypełnij wszystkie wymagane pola');
      return;
    }
    addExceptionMutation.mutate(exceptionForm);
  };

  const handleDeleteException = (exceptionId: string) => {
    setDeleteDialog({ isOpen: true, exceptionId });
  };

  const confirmDeleteException = async () => {
    if (deleteDialog.exceptionId) {
      await deleteExceptionMutation.mutateAsync(deleteDialog.exceptionId);
      setDeleteDialog({ isOpen: false, exceptionId: null });
    }
  };

  const handleSavePreferences = () => {
    updatePreferencesMutation.mutate(preferencesForm);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getSlotsForDay = (dayOfWeek: number) => {
    const slots = isEditMode ? editingSlots : teacher?.availability || [];
    return slots.filter((slot) => slot.dayOfWeek === dayOfWeek);
  };

  if (isLoadingTeacher) {
    return <LoadingSpinner message="Ładowanie dostępności..." />;
  }

  if (!teacher) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">Nie znaleziono danych lektora</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dostępność</h1>
        <p className="mt-2 text-gray-600">
          Zarządzaj swoją tygodniową dostępnością i wyjątkami (urlopy, święta)
        </p>
      </div>

      {/* Weekly Availability */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900">Tygodniowa dostępność</h2>
          </div>
          {!isEditMode ? (
            <button
              onClick={handleEditMode}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Edytuj dostępność
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleSaveAvailability}
                disabled={updateAvailabilityMutation.isPending}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {updateAvailabilityMutation.isPending ? 'Zapisywanie...' : 'Zapisz'}
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const daySlots = getSlotsForDay(day.value);
            return (
              <div key={day.value} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{day.label}</h3>
                  {isEditMode && (
                    <button
                      onClick={() => handleAddSlot(day.value)}
                      className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Dodaj przedział
                    </button>
                  )}
                </div>

                {daySlots.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Brak dostępności</p>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map((slot, slotIndex) => {
                      const globalIndex = (isEditMode ? editingSlots : teacher.availability).findIndex(
                        (s) => s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime && s.endTime === slot.endTime
                      );
                      return (
                        <div key={slotIndex} className="flex items-center gap-3">
                          {isEditMode ? (
                            <>
                              <input
                                type="time"
                                value={slot.startTime}
                                onChange={(e) => handleSlotChange(globalIndex, 'startTime', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg"
                              />
                              <span className="text-gray-500">-</span>
                              <input
                                type="time"
                                value={slot.endTime}
                                onChange={(e) => handleSlotChange(globalIndex, 'endTime', e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg"
                              />
                              <button
                                onClick={() => handleRemoveSlot(globalIndex)}
                                className="text-red-600 hover:text-red-700"
                                title="Usuń przedział"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <p className="text-sm text-gray-700">
                              {slot.startTime} - {slot.endTime}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Availability Exceptions (Blackout Dates) */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900">Wyjątki dostępności</h2>
          </div>
          <button
            onClick={() => setShowAddException(!showAddException)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Dodaj wyjątek
          </button>
        </div>

        {/* Add Exception Form */}
        {showAddException && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="font-medium text-gray-900 mb-4">Nowy wyjątek</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data rozpoczęcia *
                </label>
                <input
                  type="date"
                  value={exceptionForm.startDate}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data zakończenia *
                </label>
                <input
                  type="date"
                  value={exceptionForm.endDate}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Powód (opcjonalnie)</label>
              <input
                type="text"
                value={exceptionForm.reason || ''}
                onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                placeholder="np. Urlop, Święta, Konferencja..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddException}
                disabled={addExceptionMutation.isPending}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {addExceptionMutation.isPending ? 'Dodawanie...' : 'Dodaj'}
              </button>
              <button
                onClick={() => {
                  setShowAddException(false);
                  setExceptionForm({ startDate: '', endDate: '', reason: '' });
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Anuluj
              </button>
            </div>
          </div>
        )}

        {/* Exceptions List */}
        {isLoadingExceptions ? (
          <LoadingSpinner message="Ładowanie wyjątków..." />
        ) : exceptions.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Brak wyjątków. Dodaj urlopy, święta lub inne okresy niedostępności.
          </p>
        ) : (
          <div className="space-y-3">
            {exceptions.map((exception: AvailabilityException) => (
              <div
                key={exception.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {formatDate(exception.startDate)} - {formatDate(exception.endDate)}
                  </p>
                  {exception.reason && <p className="text-sm text-gray-600 mt-1">{exception.reason}</p>}
                </div>
                <button
                  onClick={() => handleDeleteException(exception.id)}
                  disabled={deleteExceptionMutation.isPending}
                  className="text-red-600 hover:text-red-700 transition-colors"
                  title="Usuń wyjątek"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teacher Preferences */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900">Preferencje grafiku</h2>
          </div>
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="text-sm text-primary hover:text-primary/80"
          >
            {showPreferences ? 'Ukryj' : 'Pokaż'}
          </button>
        </div>

        {showPreferences && (
          <div>
            {isLoadingPreferences ? (
              <LoadingSpinner message="Ładowanie preferencji..." />
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Strefa czasowa
                    </label>
                    <select
                      value={preferencesForm.timezone}
                      onChange={(e) => setPreferencesForm({ ...preferencesForm, timezone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Europe/Warsaw">Europe/Warsaw (GMT+1)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="America/New_York">America/New_York (GMT-5)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (GMT+9)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Czas przygotowania (minuty)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={preferencesForm.prepTimeMinutes}
                      onChange={(e) =>
                        setPreferencesForm({ ...preferencesForm, prepTimeMinutes: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Czas potrzebny na przygotowanie przed każdą lekcją
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maks. lekcji dziennie (opcjonalnie)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={preferencesForm.maxLessonsPerDay || ''}
                      onChange={(e) =>
                        setPreferencesForm({
                          ...preferencesForm,
                          maxLessonsPerDay: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="Bez limitu"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min. przerwa między lekcjami (minuty)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="5"
                      value={preferencesForm.minBreakBetweenMinutes}
                      onChange={(e) =>
                        setPreferencesForm({
                          ...preferencesForm,
                          minBreakBetweenMinutes: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimalna przerwa między zajęciami</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleSavePreferences}
                    disabled={updatePreferencesMutation.isPending}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {updatePreferencesMutation.isPending ? 'Zapisywanie...' : 'Zapisz preferencje'}
                  </button>
                  <button
                    onClick={() => setShowPreferences(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, exceptionId: null })}
        onConfirm={confirmDeleteException}
        title="Usuń wyjątek"
        message="Czy na pewno chcesz usunąć ten wyjątek dostępności?"
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />
    </div>
  );
};

export default TeacherAvailabilityPage;
