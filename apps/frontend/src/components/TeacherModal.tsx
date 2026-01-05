import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { teacherService, Teacher, CreateTeacherData, UpdateTeacherData } from '../services/teacherService';
import { X } from 'lucide-react';

interface TeacherModalProps {
  teacher: Teacher | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CONTRACT_TYPES = [
  { value: 'B2B', label: 'B2B' },
  { value: 'EMPLOYMENT', label: 'Umowa o pracę' },
  { value: 'CIVIL', label: 'Umowa cywilna' },
];

const TeacherModal: React.FC<TeacherModalProps> = ({ teacher, onClose, onSuccess }) => {
  const isEdit = !!teacher;

  const [formData, setFormData] = useState({
    firstName: teacher?.user.firstName || '',
    lastName: teacher?.user.lastName || '',
    email: teacher?.user.email || '',
    phone: teacher?.user.phone || '',
    password: '',
    hourlyRate: teacher?.hourlyRate || 100,
    contractType: teacher?.contractType || 'B2B',
    specializations: teacher?.specializations.join(', ') || '',
    languages: teacher?.languages.join(', ') || '',
    bio: teacher?.bio || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateTeacherData) => teacherService.createTeacher(data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      setErrors({ form: error.response?.data?.error?.message || 'Błąd tworzenia lektora' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeacherData }) =>
      teacherService.updateTeacher(id, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      setErrors({ form: error.response?.data?.error?.message || 'Błąd aktualizacji lektora' });
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
          contractType: formData.contractType as 'B2B' | 'EMPLOYMENT' | 'CIVIL',
          specializations: specializationsArray,
          languages: languagesArray,
          bio: formData.bio || undefined,
        },
      });
    } else {
      await createMutation.mutateAsync({
        ...formData,
        phone: formData.phone || undefined,
        hourlyRate: formData.hourlyRate,
        contractType: formData.contractType as 'B2B' | 'EMPLOYMENT' | 'CIVIL',
        specializations: specializationsArray,
        languages: languagesArray,
        bio: formData.bio || undefined,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
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
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Typ umowy *</label>
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

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Krótki opis lektora..."
                />
              </div>
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
