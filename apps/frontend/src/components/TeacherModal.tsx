import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { teacherService, Teacher, CreateTeacherData, UpdateTeacherData } from '../services/teacherService';
import { X, RefreshCw, Copy, Check } from 'lucide-react';
import { handleApiError } from '../lib/errorUtils';
import { generateSecurePassword } from '../lib/passwordUtils';

interface TeacherModalProps {
  teacher: Teacher | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CONTRACT_TYPES = [
  { value: '', label: 'Wybierz typ umowy' },
  { value: 'B2B', label: 'B2B' },
  { value: 'EMPLOYMENT', label: 'Umowa o pracę' },
  { value: 'CIVIL', label: 'Umowa cywilna' },
];

const TeacherModal: React.FC<TeacherModalProps> = ({ teacher, onClose, onSuccess }) => {
  const isEdit = !!teacher;
  const [passwordCopied, setPasswordCopied] = useState(false);

  const [formData, setFormData] = useState({
    firstName: teacher?.user.firstName || '',
    lastName: teacher?.user.lastName || '',
    email: teacher?.user.email || '',
    phone: teacher?.user.phone || '',
    password: '',
    hourlyRate: teacher?.hourlyRate || 100,
    contractType: teacher?.contractType || '',
    specializations: teacher?.specializations.join(', ') || '',
    languages: teacher?.languages.join(', ') || '',
    cancellationPayoutEnabled: teacher?.cancellationPayoutEnabled ?? false,
    cancellationPayoutHours: teacher?.cancellationPayoutHours ?? null as number | null,
    cancellationPayoutPercent: teacher?.cancellationPayoutPercent ?? null as number | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateTeacherData) => teacherService.createTeacher(data),
    onSuccess: () => {
      toast.success('Lektor został pomyślnie utworzony');
      onSuccess();
    },
    onError: (error: any) => {
      const { fieldErrors, message } = handleApiError(error, 'Błąd tworzenia lektora');
      toast.error(message);
      setErrors(fieldErrors);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeacherData }) =>
      teacherService.updateTeacher(id, data),
    onSuccess: () => {
      toast.success('Dane lektora zostały zaktualizowane');
      onSuccess();
    },
    onError: (error: any) => {
      const { fieldErrors, message } = handleApiError(error, 'Błąd aktualizacji lektora');
      toast.error(message);
      setErrors(fieldErrors);
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
    if (!formData.hourlyRate || formData.hourlyRate <= 0) {
      newErrors.hourlyRate = 'Stawka musi być większa niż 0';
    }
    if (formData.cancellationPayoutEnabled) {
      if (!formData.cancellationPayoutHours || formData.cancellationPayoutHours <= 0) {
        newErrors.cancellationPayoutHours = 'Próg godzin jest wymagany i musi być > 0';
      }
      if (formData.cancellationPayoutPercent === null || formData.cancellationPayoutPercent === undefined) {
        newErrors.cancellationPayoutPercent = 'Procent wypłaty jest wymagany';
      } else if (formData.cancellationPayoutPercent < 0 || formData.cancellationPayoutPercent > 100) {
        newErrors.cancellationPayoutPercent = 'Procent musi być od 0 do 100';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const specializationsArray = formData.specializations
      ? formData.specializations.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const languagesArray = formData.languages
      ? formData.languages.split(',').map((l) => l.trim()).filter(Boolean)
      : [];

    if (isEdit && teacher) {
      await updateMutation.mutateAsync({
        id: teacher.id,
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          hourlyRate: formData.hourlyRate,
          contractType: formData.contractType ? formData.contractType as 'B2B' | 'EMPLOYMENT' | 'CIVIL' : undefined,
          specializations: specializationsArray,
          languages: languagesArray,
          cancellationPayoutEnabled: formData.cancellationPayoutEnabled,
          cancellationPayoutHours: formData.cancellationPayoutEnabled ? formData.cancellationPayoutHours : null,
          cancellationPayoutPercent: formData.cancellationPayoutEnabled ? formData.cancellationPayoutPercent : null,
        },
      });
    } else {
      await createMutation.mutateAsync({
        ...formData,
        phone: formData.phone || undefined,
        hourlyRate: formData.hourlyRate,
        contractType: formData.contractType ? formData.contractType as 'B2B' | 'EMPLOYMENT' | 'CIVIL' : undefined,
        specializations: specializationsArray,
        languages: languagesArray,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : type === 'number'
        ? (value === '' ? null : parseFloat(value))
        : value;
    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
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
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edytuj lektora' : 'Dodaj nowego lektora'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.form && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.form}
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dane osobowe</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imię *</label>
                <input
                  type="text"
                  name="firstName"
                  autoComplete="off"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.firstName && <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko *</label>
                <input
                  type="text"
                  name="lastName"
                  autoComplete="off"
                  value={formData.lastName}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.lastName && <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="off"
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="password"
                      autoComplete="off"
                      value={formData.password}
                      onChange={handleChange}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const pwd = generateSecurePassword(12);
                        setFormData((prev) => ({ ...prev, password: pwd }));
                        setErrors((prev) => { const e = { ...prev }; delete e.password; return e; });
                      }}
                      title="Generuj hasło"
                      className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4 text-gray-600" />
                    </button>
                    <button
                      type="button"
                      disabled={!formData.password}
                      onClick={() => {
                        navigator.clipboard.writeText(formData.password);
                        setPasswordCopied(true);
                        setTimeout(() => setPasswordCopied(false), 2000);
                      }}
                      title="Kopiuj hasło"
                      className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40"
                    >
                      {passwordCopied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    Wpisz hasło ręcznie lub wygeneruj automatycznie. Przekaż je lektorowi przed pierwszym logowaniem.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dane zatrudnienia</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stawka godzinowa (PLN) *
                </label>
                <input
                  type="number"
                  name="hourlyRate"
                  value={formData.hourlyRate}
                  onChange={handleChange}
                  min="0"
                  step="1"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.hourlyRate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.hourlyRate && <p className="mt-1 text-sm text-red-600">{errors.hourlyRate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ umowy</label>
                <select
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CONTRACT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specjalizacje (oddziel przecinkami)
                </label>
                <input
                  type="text"
                  name="specializations"
                  value={formData.specializations}
                  onChange={handleChange}
                  placeholder="np. Business English, IELTS, Konwersacje"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Języki (oddziel przecinkami)
                </label>
                <input
                  type="text"
                  name="languages"
                  value={formData.languages}
                  onChange={handleChange}
                  placeholder="np. Angielski, Polski, Niemiecki"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Cancellation payout settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ustawienia odwołań</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">Wypłata przy odwołaniu lekcji</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Lektor otrzymuje część stawki gdy lekcja zostanie odwołana w krótkim czasie przed jej rozpoczęciem
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    name="cancellationPayoutEnabled"
                    checked={formData.cancellationPayoutEnabled}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {formData.cancellationPayoutEnabled && (
                <div className="grid grid-cols-2 gap-4 pl-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Próg godzin przed lekcją *
                    </label>
                    <input
                      type="number"
                      name="cancellationPayoutHours"
                      value={formData.cancellationPayoutHours ?? ''}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      placeholder="np. 24"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                        errors.cancellationPayoutHours ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    <p className="mt-1 text-xs text-gray-500">Jeśli odwołanie nastąpi w tym czasie, lektor dostaje wypłatę</p>
                    {errors.cancellationPayoutHours && (
                      <p className="mt-1 text-sm text-red-600">{errors.cancellationPayoutHours}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      % stawki do wypłaty *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        name="cancellationPayoutPercent"
                        value={formData.cancellationPayoutPercent ?? ''}
                        onChange={handleChange}
                        min="0"
                        max="100"
                        step="1"
                        placeholder="np. 80"
                        className={`w-full px-3 py-2 pr-8 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          errors.cancellationPayoutPercent ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">0–100% normalnej stawki godzinowej</p>
                    {errors.cancellationPayoutPercent && (
                      <p className="mt-1 text-sm text-red-600">{errors.cancellationPayoutPercent}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

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
                : 'Dodaj lektora'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeacherModal;
