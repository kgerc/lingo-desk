import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { courseTypeService, CourseType, CreateCourseTypeData, UpdateCourseTypeData } from '../services/courseTypeService';
import { X } from 'lucide-react';

interface CourseTypeModalProps {
  courseType: CourseType | null;
  onClose: () => void;
  onSuccess: () => void;
}

const LANGUAGES = [
  { value: 'en', label: 'Angielski' },
  { value: 'de', label: 'Niemiecki' },
  { value: 'es', label: 'Hiszpański' },
  { value: 'fr', label: 'Francuski' },
  { value: 'it', label: 'Włoski' },
  { value: 'pl', label: 'Polski' },
];

const LANGUAGE_LEVELS = [
  { value: 'A1', label: 'A1 - Początkujący' },
  { value: 'A2', label: 'A2 - Podstawowy' },
  { value: 'B1', label: 'B1 - Średniozaawansowany' },
  { value: 'B2', label: 'B2 - Średniozaawansowany wyższy' },
  { value: 'C1', label: 'C1 - Zaawansowany' },
  { value: 'C2', label: 'C2 - Biegły' },
  { value: 'BEGINNER', label: 'Początkujący' },
  { value: 'INTERMEDIATE', label: 'Średniozaawansowany' },
  { value: 'ADVANCED', label: 'Zaawansowany' },
  { value: 'ALL_LEVELS', label: 'Wszystkie poziomy' },
];

const COURSE_FORMATS = [
  { value: 'INDIVIDUAL', label: 'Indywidualne' },
  { value: 'GROUP', label: 'Grupowe' },
  { value: 'HYBRID', label: 'Hybrydowe' },
];

const DELIVERY_MODES = [
  { value: 'IN_PERSON', label: 'Stacjonarne' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'BOTH', label: 'Stacjonarne i Online' },
];

const CourseTypeModal: React.FC<CourseTypeModalProps> = ({ courseType, onClose, onSuccess }) => {
  const isEdit = !!courseType;

  const [formData, setFormData] = useState({
    name: courseType?.name || '',
    description: courseType?.description || '',
    language: courseType?.language || 'en',
    level: courseType?.level || 'A1',
    format: courseType?.format || 'INDIVIDUAL',
    deliveryMode: courseType?.deliveryMode || 'BOTH',
    defaultDurationMinutes: courseType?.defaultDurationMinutes || 60,
    maxStudents: courseType?.maxStudents || null,
    pricePerLesson: courseType?.pricePerLesson || 0,
    currency: courseType?.currency || 'PLN',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: (data: CreateCourseTypeData) => courseTypeService.createCourseType(data),
    onSuccess: () => {
      toast.success('Typ kursu został pomyślnie utworzony');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Błąd tworzenia typu kursu';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCourseTypeData }) =>
      courseTypeService.updateCourseType(id, data),
    onSuccess: () => {
      toast.success('Typ kursu został pomyślnie zaktualizowany');
      onSuccess();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Błąd aktualizacji typu kursu';
      toast.error(errorMessage);
      setErrors({ form: errorMessage });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa jest wymagana';
    }

    if (!formData.language) {
      newErrors.language = 'Język jest wymagany';
    }

    if (formData.defaultDurationMinutes <= 0) {
      newErrors.defaultDurationMinutes = 'Czas trwania musi być większy od 0';
    }

    if (formData.pricePerLesson < 0) {
      newErrors.pricePerLesson = 'Cena nie może być ujemna';
    }

    if (formData.maxStudents !== null && formData.maxStudents < 1) {
      newErrors.maxStudents = 'Maksymalna liczba uczniów musi być większa od 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      language: formData.language,
      level: formData.level,
      format: formData.format,
      deliveryMode: formData.deliveryMode,
      defaultDurationMinutes: formData.defaultDurationMinutes,
      maxStudents: formData.maxStudents || undefined,
      pricePerLesson: formData.pricePerLesson,
      currency: formData.currency,
    };

    if (isEdit) {
      await updateMutation.mutateAsync({
        id: courseType.id,
        data: submitData,
      });
    } else {
      await createMutation.mutateAsync(submitData as CreateCourseTypeData);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = value === '' ? (name === 'maxStudents' ? null : 0) : parseFloat(value);
    setFormData((prev) => ({
      ...prev,
      [name]: numValue,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edytuj typ kursu' : 'Dodaj nowy typ kursu'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {errors.form && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nazwa typu kursu *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="np. Angielski Biznesowy, Niemiecki dla Dzieci"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opis
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Opcjonalny opis typu kursu"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Język *
              </label>
              <select
                name="language"
                value={formData.language}
                onChange={handleInputChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.language ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              {errors.language && <p className="mt-1 text-sm text-red-500">{errors.language}</p>}
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poziom *
              </label>
              <select
                name="level"
                value={formData.level}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format *
              </label>
              <select
                name="format"
                value={formData.format}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {COURSE_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sposób prowadzenia *
              </label>
              <select
                name="deliveryMode"
                value={formData.deliveryMode}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {DELIVERY_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domyślny czas trwania (minuty) *
              </label>
              <input
                type="number"
                name="defaultDurationMinutes"
                value={formData.defaultDurationMinutes}
                onChange={handleNumberChange}
                min="1"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.defaultDurationMinutes ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="60"
              />
              {errors.defaultDurationMinutes && (
                <p className="mt-1 text-sm text-red-500">{errors.defaultDurationMinutes}</p>
              )}
            </div>

            {/* Max Students */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maksymalna liczba uczniów
              </label>
              <input
                type="number"
                name="maxStudents"
                value={formData.maxStudents ?? ''}
                onChange={handleNumberChange}
                min="1"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.maxStudents ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Pozostaw puste dla nieograniczonej liczby"
              />
              {errors.maxStudents && (
                <p className="mt-1 text-sm text-red-500">{errors.maxStudents}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Dla zajęć indywidualnych pozostaw puste lub wpisz 1
              </p>
            </div>

            {/* Price Per Lesson */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cena za lekcję *
              </label>
              <input
                type="number"
                name="pricePerLesson"
                value={formData.pricePerLesson}
                onChange={handleNumberChange}
                min="0"
                step="0.01"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.pricePerLesson ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0.00"
              />
              {errors.pricePerLesson && (
                <p className="mt-1 text-sm text-red-500">{errors.pricePerLesson}</p>
              )}
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Waluta *
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
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
              <p className="text-xs text-gray-500 mt-1">
                Waluta domyślna dla lekcji tego typu kursu
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Zapisywanie...'
                : isEdit
                ? 'Zapisz zmiany'
                : 'Dodaj typ kursu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseTypeModal;
