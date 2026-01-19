import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import organizationService, { VisibilitySettings } from '../services/organizationService';
import { Eye, Save, Users, GraduationCap } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const DEFAULT_VISIBILITY: VisibilitySettings = {
  teacher: {
    hourlyRate: true,
    contractType: true,
    email: true,
    phone: true,
    notes: true,
    payouts: true,
  },
  student: {
    email: true,
    phone: true,
    address: true,
    dateOfBirth: true,
    notes: true,
    payments: true,
    budget: true,
  },
};

const VisibilitySettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = React.useState<VisibilitySettings>(DEFAULT_VISIBILITY);

  const { data: visibility, isLoading } = useQuery({
    queryKey: ['visibilitySettings'],
    queryFn: () => organizationService.getVisibilitySettings(),
  });

  React.useEffect(() => {
    if (visibility) {
      setFormData(visibility);
    }
  }, [visibility]);

  const updateMutation = useMutation({
    mutationFn: (data: VisibilitySettings) => organizationService.updateVisibilitySettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visibilitySettings'] });
      toast.success('Ustawienia widocznosci zostaly zapisane');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Blad podczas zapisywania ustawien');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleTeacherChange = (field: keyof VisibilitySettings['teacher']) => {
    setFormData({
      ...formData,
      teacher: {
        ...formData.teacher,
        [field]: !formData.teacher[field],
      },
    });
  };

  const handleStudentChange = (field: keyof VisibilitySettings['student']) => {
    setFormData({
      ...formData,
      student: {
        ...formData.student,
        [field]: !formData.student[field],
      },
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Ladowanie ustawien widocznosci..." />;
  }

  const teacherFields: { key: keyof VisibilitySettings['teacher']; label: string; description: string }[] = [
    { key: 'hourlyRate', label: 'Stawka godzinowa', description: 'Informacja o stawce za godzine lekcji' },
    { key: 'contractType', label: 'Typ umowy', description: 'Rodzaj umowy z lektorem (UoP, B2B, itp.)' },
    { key: 'email', label: 'Email', description: 'Adres email lektora' },
    { key: 'phone', label: 'Telefon', description: 'Numer telefonu lektora' },
    { key: 'notes', label: 'Notatki', description: 'Notatki i bio lektora' },
    { key: 'payouts', label: 'Wyplaty', description: 'Historia wyplat lektora' },
  ];

  const studentFields: { key: keyof VisibilitySettings['student']; label: string; description: string }[] = [
    { key: 'email', label: 'Email', description: 'Adres email ucznia' },
    { key: 'phone', label: 'Telefon', description: 'Numer telefonu ucznia' },
    { key: 'address', label: 'Adres', description: 'Adres zamieszkania ucznia' },
    { key: 'dateOfBirth', label: 'Data urodzenia', description: 'Data urodzenia ucznia' },
    { key: 'notes', label: 'Notatki', description: 'Notatki i cele nauki ucznia' },
    { key: 'payments', label: 'Platnosci', description: 'Historia platnosci ucznia' },
    { key: 'budget', label: 'Budzet', description: 'Informacje o budzecie godzinowym' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Eye className="h-8 w-8 text-primary" />
          Widocznosc danych dla Managerow
        </h1>
        <p className="mt-2 text-gray-600">
          Okresl, ktore dane o lektorach i uczniach beda widoczne dla uzytkownikow z rola Manager.
          Administratorzy zawsze maja pelny dostep do wszystkich danych.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Teacher Visibility */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Dane lektorow
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Wybierz, ktore informacje o lektorach beda dostepne dla Managerow
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {teacherFields.map((field) => (
                <label
                  key={field.key}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.teacher[field.key]}
                      onChange={() => handleTeacherChange(field.key)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:bg-primary"></div>
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white border border-gray-300 rounded-full transition-transform peer-checked:translate-x-5 peer-checked:border-white"></div>
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                      {field.label}
                    </span>
                    <p className="text-sm text-gray-500">{field.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Student Visibility */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-green-600" />
              Dane uczniow
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Wybierz, ktore informacje o uczniach beda dostepne dla Managerow
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {studentFields.map((field) => (
                <label
                  key={field.key}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.student[field.key]}
                      onChange={() => handleStudentChange(field.key)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:bg-primary"></div>
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white border border-gray-300 rounded-full transition-transform peer-checked:translate-x-5 peer-checked:border-white"></div>
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                      {field.label}
                    </span>
                    <p className="text-sm text-gray-500">{field.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Zapisywanie...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Zapisz ustawienia
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VisibilitySettingsPage;
