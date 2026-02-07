import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import courseApplicationService, { SubmitApplicationData } from '../services/courseApplicationService';
import { CheckCircle, Send, Loader2 } from 'lucide-react';

const LANGUAGE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function PublicApplicationForm() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<SubmitApplicationData>({
    name: '',
    email: '',
    phone: '',
    courseId: '',
    preferences: '',
    languageLevel: '',
    availability: '',
    notes: '',
  });

  // Fetch public courses and org info
  const { data, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['public-courses', orgSlug],
    queryFn: () => courseApplicationService.getPublicCourses(orgSlug!),
    enabled: !!orgSlug,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const submitData: SubmitApplicationData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        courseId: formData.courseId || undefined,
        preferences: formData.preferences || undefined,
        languageLevel: formData.languageLevel || undefined,
        availability: formData.availability || undefined,
        notes: formData.notes || undefined,
      };
      return courseApplicationService.submitApplication(orgSlug!, submitData);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Imię i nazwisko jest wymagane';
    if (!formData.email.trim()) {
      newErrors.email = 'Email jest wymagany';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Nieprawidłowy format email';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    submitMutation.mutate();
  };

  const handleChange = (field: keyof SubmitApplicationData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const organization = data?.organization;
  const courses = data?.courses || [];
  const primaryColor = organization?.primaryColor || '#3B82F6';

  if (isLoadingCourses) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Nie znaleziono szkoły</h1>
          <p className="text-gray-600">Sprawdź poprawność linku do formularza zapisu.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: primaryColor }} />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Zgłoszenie wysłane!</h1>
          <p className="text-gray-600">
            Dziękujemy za zainteresowanie naszą ofertą. Skontaktujemy się z Tobą wkrótce.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {organization.logoUrl && (
            <img src={organization.logoUrl} alt={organization.name} className="h-16 mx-auto mb-4" />
          )}
          <h1 className="text-3xl font-bold text-gray-900">{organization.name}</h1>
          <p className="text-gray-600 mt-2">Formularz zapisu na kurs</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imię i nazwisko <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="Jan Kowalski"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
              }`}
              placeholder="jan@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+48 123 456 789"
            />
          </div>

          {/* Course selection */}
          {courses.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferowany kurs</label>
              <select
                value={formData.courseId}
                onChange={(e) => handleChange('courseId', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Wybierz kurs --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.level})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preferences */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferencje / oczekiwania</label>
            <textarea
              value={formData.preferences}
              onChange={(e) => handleChange('preferences', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="np. angielski biznesowy, konwersacje..."
            />
          </div>

          {/* Language level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Poziom językowy</label>
            <select
              value={formData.languageLevel}
              onChange={(e) => handleChange('languageLevel', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Nie wiem / Nie dotyczy --</option>
              {LANGUAGE_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {/* Availability */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dostępność (dni/godziny)</label>
            <textarea
              value={formData.availability}
              onChange={(e) => handleChange('availability', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
              placeholder="np. poniedziałki i środy, 17:00-19:00"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dodatkowe uwagi</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={2}
            />
          </div>

          {/* Submit error */}
          {submitMutation.isError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {(submitMutation.error as any)?.response?.data?.error?.message || 'Wystąpił błąd. Spróbuj ponownie.'}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {submitMutation.isPending ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
          </button>
        </form>
      </div>
    </div>
  );
}
