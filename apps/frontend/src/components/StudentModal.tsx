import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { studentService, Student, CreateStudentData, UpdateStudentData } from '../services/studentService';
import { X } from 'lucide-react';

interface StudentModalProps {
  student: Student | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LANGUAGE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

const LANGUAGES = [
  { value: 'en', label: 'Angielski' },
  { value: 'de', label: 'Niemiecki' },
  { value: 'es', label: 'Hiszpański' },
  { value: 'fr', label: 'Francuski' },
  { value: 'it', label: 'Włoski' },
  { value: 'pl', label: 'Polski' },
];

type TabType = 'personal' | 'cancellation';

const StudentModal: React.FC<StudentModalProps> = ({ student, onClose, onSuccess }) => {
  const isEdit = !!student;
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  const [formData, setFormData] = useState({
    firstName: student?.user.firstName || '',
    lastName: student?.user.lastName || '',
    email: student?.user.email || '',
    phone: student?.user.phone || '',
    password: '',
    dateOfBirth: student?.user.profile?.dateOfBirth?.split('T')[0] || '',
    address: student?.user.profile?.address || '',
    languageLevel: student?.languageLevel || 'A1',
    language: student?.language || 'en',
    goals: student?.goals || '',
    isMinor: student?.isMinor || false,
    paymentDueDays: student?.paymentDueDays || null,
    paymentDueDayOfMonth: student?.paymentDueDayOfMonth || null,
    // Cancellation fee settings
    cancellationFeeEnabled: student?.cancellationFeeEnabled || false,
    cancellationHoursThreshold: student?.cancellationHoursThreshold || null,
    cancellationFeePercent: student?.cancellationFeePercent || null,
    // Cancellation limit settings
    cancellationLimitEnabled: student?.cancellationLimitEnabled || false,
    cancellationLimitCount: student?.cancellationLimitCount || null,
    cancellationLimitPeriod: student?.cancellationLimitPeriod || 'month',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateStudentData) => studentService.createStudent(data),
    onSuccess: () => {
      toast.success('Uczeń został pomyślnie utworzony');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Błąd tworzenia ucznia';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStudentData }) =>
      studentService.updateStudent(id, data),
    onSuccess: () => {
      toast.success('Dane ucznia zostały zaktualizowane');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Błąd aktualizacji ucznia';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'Imię jest wymagane';
    if (!formData.lastName.trim()) newErrors.lastName = 'Nazwisko jest wymagane';
    if (!formData.email.trim()) newErrors.email = 'Email jest wymagany';
    if (!isEdit && !formData.password) newErrors.password = 'Hasło jest wymagane';
    if (!isEdit && formData.password && formData.password.length < 8) {
      newErrors.password = 'Hasło musi mieć min. 8 znaków';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    if (isEdit && student) {
      await updateMutation.mutateAsync({
        id: student.id,
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
          address: formData.address || undefined,
          languageLevel: formData.languageLevel,
          language: formData.language,
          goals: formData.goals || undefined,
          isMinor: formData.isMinor,
          paymentDueDays: formData.paymentDueDays || undefined,
          paymentDueDayOfMonth: formData.paymentDueDayOfMonth || undefined,
          // Cancellation fee settings
          cancellationFeeEnabled: formData.cancellationFeeEnabled,
          cancellationHoursThreshold: formData.cancellationFeeEnabled ? formData.cancellationHoursThreshold : null,
          cancellationFeePercent: formData.cancellationFeeEnabled ? formData.cancellationFeePercent : null,
          // Cancellation limit settings
          cancellationLimitEnabled: formData.cancellationLimitEnabled,
          cancellationLimitCount: formData.cancellationLimitEnabled ? formData.cancellationLimitCount : null,
          cancellationLimitPeriod: formData.cancellationLimitEnabled ? formData.cancellationLimitPeriod : null,
        },
      });
    } else {
      await createMutation.mutateAsync({
        ...formData,
        phone: formData.phone || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        address: formData.address || undefined,
        goals: formData.goals || undefined,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edytuj ucznia' : 'Dodaj nowego ucznia'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px px-6">
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'personal'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Dane osobowe
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cancellation')}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cancellation'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Ustawienia odwołań
            </button>
          </nav>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.form}
            </div>
          )}

          {/* Personal Info Tab */}
          {activeTab === 'personal' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dane osobowe</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imię *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwisko *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {!isEdit && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hasło * (min. 8 znaków)
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data urodzenia
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Język nauczania *
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
                  Poziom języka *
                </label>
                <select
                  name="languageLevel"
                  value={formData.languageLevel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {LANGUAGE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adres
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cele nauki
                </label>
                <textarea
                  name="goals"
                  value={formData.goals}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Np. Chcę poprawić konwersację..."
                />
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="isMinor"
                    checked={formData.isMinor}
                    onChange={handleChange}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Uczeń niepełnoletni
                  </span>
                </label>
              </div>

              {/* Payment Due Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Termin płatności (dni)
                </label>
                <input
                  type="number"
                  name="paymentDueDays"
                  min="0"
                  value={formData.paymentDueDays ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    paymentDueDays: e.target.value ? parseInt(e.target.value) : null,
                    paymentDueDayOfMonth: null, // Clear day of month when setting days
                  })}
                  disabled={formData.paymentDueDayOfMonth !== null}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="np. 7, 14, 30"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Liczba dni po zakończeniu lekcji
                </p>
              </div>

              {/* Payment Due Day of Month */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dzień miesiąca płatności
                </label>
                <input
                  type="number"
                  name="paymentDueDayOfMonth"
                  min="1"
                  max="31"
                  value={formData.paymentDueDayOfMonth ?? ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    paymentDueDayOfMonth: e.target.value ? parseInt(e.target.value) : null,
                    paymentDueDays: null, // Clear days when setting day of month
                  })}
                  disabled={formData.paymentDueDays !== null}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="np. 10, 15, 25"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Konkretny dzień miesiąca (np. zawsze 10-go)
                </p>
              </div>

              <div className="col-span-2">
                <p className="text-xs text-gray-500">
                  ℹ️ Wybierz jedno z powyższych. Pozostaw oba puste aby traktować jako dłużnika natychmiast.
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Cancellation Settings Tab */}
          {activeTab === 'cancellation' && (
          <>
          {/* Cancellation Fee Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Płatne odwołanie lekcji</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cancellationFeeEnabled"
                  checked={formData.cancellationFeeEnabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    cancellationFeeEnabled: e.target.checked,
                  })}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="cancellationFeeEnabled" className="text-sm font-medium text-gray-700">
                  Włącz opłatę za późne odwołanie
                </label>
              </div>

              {formData.cancellationFeeEnabled && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/30">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Próg godzinowy *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={formData.cancellationHoursThreshold ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        cancellationHoursThreshold: e.target.value ? parseInt(e.target.value) : null,
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="np. 24"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Liczba godzin przed lekcją, po których naliczana jest opłata
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Procent opłaty *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formData.cancellationFeePercent ?? ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          cancellationFeePercent: e.target.value ? parseInt(e.target.value) : null,
                        })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent pr-8"
                        placeholder="np. 70"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Procent ceny lekcji naliczany przy późnym odwołaniu
                    </p>
                  </div>

                  <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      <strong>Przykład:</strong> Przy progu {formData.cancellationHoursThreshold || 24}h i opłacie {formData.cancellationFeePercent || 70}%,
                      jeśli uczeń odwoła lekcję za 100 PLN mniej niż {formData.cancellationHoursThreshold || 24} godziny przed jej rozpoczęciem,
                      zostanie naliczona opłata {((formData.cancellationFeePercent || 70) / 100 * 100).toFixed(0)} PLN.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancellation Limit Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Limit odwołań</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cancellationLimitEnabled"
                  checked={formData.cancellationLimitEnabled}
                  onChange={(e) => setFormData({
                    ...formData,
                    cancellationLimitEnabled: e.target.checked,
                  })}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="cancellationLimitEnabled" className="text-sm font-medium text-gray-700">
                  Włącz limit odwołań lekcji
                </label>
              </div>

              {formData.cancellationLimitEnabled && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-blue-300">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maksymalna liczba odwołań *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.cancellationLimitCount ?? ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        cancellationLimitCount: e.target.value ? parseInt(e.target.value) : null,
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="np. 5"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ile razy uczeń może odwołać lekcję w okresie
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Okres rozliczeniowy *
                    </label>
                    <select
                      value={formData.cancellationLimitPeriod || 'month'}
                      onChange={(e) => setFormData({
                        ...formData,
                        cancellationLimitPeriod: e.target.value,
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="month">Miesiąc</option>
                      <option value="quarter">Kwartał</option>
                      <option value="year">Rok</option>
                      <option value="enrollment">Od zapisania</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Okres, w którym liczony jest limit
                    </p>
                  </div>

                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Przykład:</strong> Przy limicie {formData.cancellationLimitCount || 5} odwołań na {
                        formData.cancellationLimitPeriod === 'month' ? 'miesiąc' :
                        formData.cancellationLimitPeriod === 'quarter' ? 'kwartał' :
                        formData.cancellationLimitPeriod === 'year' ? 'rok' : 'cały okres nauki'
                      },
                      uczeń może odwołać maksymalnie {formData.cancellationLimitCount || 5} lekcji w tym okresie.
                      Po przekroczeniu limitu nie będzie mógł odwoływać kolejnych lekcji.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
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
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Zapisywanie...'
                : isEdit
                ? 'Zaktualizuj'
                : 'Dodaj ucznia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentModal;
