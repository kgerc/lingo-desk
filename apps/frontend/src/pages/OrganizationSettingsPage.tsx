import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import organizationService, { UpdateOrganizationData } from '../services/organizationService';
import { Building2, Save, CalendarOff, Info } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const OrganizationSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch current organization
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => organizationService.getOrganization(),
  });

  // Form state
  const [formData, setFormData] = useState<UpdateOrganizationData>({});

  // Initialize form data when organization loads
  React.useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        address: organization.address || '',
        city: organization.city || '',
        postalCode: organization.postalCode || '',
        phone: organization.phone || '',
        email: organization.email || '',
        website: organization.website || '',
        taxId: organization.taxId || '',
        description: organization.description || '',
        timezone: organization.timezone || 'Europe/Warsaw',
        currency: organization.currency || 'PLN',
        country: organization.country || 'PL',
      });
    }
  }, [organization]);

  // Fetch skipHolidays setting
  const { data: holidaysSettings } = useQuery({
    queryKey: ['skipHolidays'],
    queryFn: () => organizationService.getSkipHolidays(),
  });

  const [skipHolidays, setSkipHolidays] = useState<boolean>(false);

  React.useEffect(() => {
    if (holidaysSettings) {
      setSkipHolidays(holidaysSettings.skipHolidays);
    }
  }, [holidaysSettings]);

  // Fetch list of Polish holidays for current year
  const currentYear = new Date().getFullYear();
  const { data: holidays } = useQuery({
    queryKey: ['holidays', currentYear],
    queryFn: () => organizationService.getHolidays(currentYear),
  });

  // Fetch disabled holidays
  const { data: disabledHolidaysData } = useQuery({
    queryKey: ['disabledHolidays'],
    queryFn: () => organizationService.getDisabledHolidays(),
  });

  const [disabledHolidays, setDisabledHolidays] = useState<string[]>([]);

  React.useEffect(() => {
    if (disabledHolidaysData) {
      setDisabledHolidays(disabledHolidaysData.disabledHolidays);
    }
  }, [disabledHolidaysData]);

  const disabledHolidaysMutation = useMutation({
    mutationFn: (list: string[]) => organizationService.updateDisabledHolidays(list),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disabledHolidays'] });
    },
    onError: () => {
      toast.error('Błąd podczas aktualizacji ustawień świąt');
    },
  });

  const handleHolidayToggle = (name: string, checked: boolean) => {
    // checked = "uwzględniaj" → remove from disabled list
    // unchecked = "nie uwzględniaj" → add to disabled list
    const updated = checked
      ? disabledHolidays.filter(h => h !== name)
      : [...disabledHolidays, name];
    setDisabledHolidays(updated);
    disabledHolidaysMutation.mutate(updated);
  };

  // Update skipHolidays mutation
  const skipHolidaysMutation = useMutation({
    mutationFn: (value: boolean) => organizationService.updateSkipHolidays(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skipHolidays'] });
      toast.success('Ustawienia świąt zostały zaktualizowane');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd podczas aktualizacji ustawień świąt');
    },
  });

  const handleSkipHolidaysChange = (checked: boolean) => {
    setSkipHolidays(checked);
    skipHolidaysMutation.mutate(checked);
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrganizationData) => organizationService.updateOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast.success('Dane szkoły zostały zaktualizowane');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd podczas aktualizacji danych');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie danych szkoły..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          Ustawienia Szkoły
        </h1>
        <p className="mt-2 text-gray-600">Zarządzaj danymi swojej szkoły językowej</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Podstawowe informacje</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nazwa szkoły *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opis
                </label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Krótki opis szkoły..."
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dane kontaktowe</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="kontakt@szkola.pl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="+48 123 456 789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strona WWW
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="https://szkola.pl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIP
                </label>
                <input
                  type="text"
                  name="taxId"
                  value={formData.taxId || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="123-456-78-90"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Adres</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ulica i numer
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="ul. Przykładowa 123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Miasto
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Warszawa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kod pocztowy
                </label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="00-000"
                />
              </div>
            </div>
          </div>

          {/* Regional Settings */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ustawienia regionalne</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Strefa czasowa
                </label>
                <select
                  name="timezone"
                  value={formData.timezone || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="Europe/Warsaw">Europe/Warsaw (GMT+1)</option>
                  <option value="Europe/London">Europe/London (GMT+0)</option>
                  <option value="Europe/Berlin">Europe/Berlin (GMT+1)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Waluta
                </label>
                <select
                  name="currency"
                  value={formData.currency || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PLN">PLN (zł)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kraj
                </label>
                <select
                  name="country"
                  value={formData.country || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PL">Polska</option>
                  <option value="DE">Niemcy</option>
                  <option value="GB">Wielka Brytania</option>
                  <option value="US">Stany Zjednoczone</option>
                </select>
              </div>
            </div>
          </div>

          {/* Holiday Settings */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CalendarOff className="h-5 w-5 text-primary" />
              Święta i dni wolne
            </h2>
            <div className="flex items-start gap-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipHolidays}
                  onChange={(e) => handleSkipHolidaysChange(e.target.checked)}
                  className="sr-only peer"
                  disabled={skipHolidaysMutation.isPending}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Uwzględniaj polskie święta przy planowaniu lekcji
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Po włączeniu system automatycznie pominie dni ustawowo wolne od pracy
                  przy tworzeniu harmonogramu kursu oraz zablokuje możliwość tworzenia
                  pojedynczych lekcji w te dni.
                </p>
              </div>
            </div>

            {skipHolidays && holidays && holidays.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-medium text-gray-900">
                    Lista świąt ({currentYear})
                  </p>
                  <span
                    className="text-gray-400 cursor-help"
                    title="Odznacz święto, aby lekcje mogły odbywać się w tym dniu mimo włączonego blokowania świąt."
                  >
                    <Info className="h-4 w-4" />
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {holidays.map((holiday) => {
                    const isActive = !disabledHolidays.includes(holiday.name);
                    const date = new Date(holiday.date);
                    const formatted = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
                    return (
                      <label
                        key={holiday.name}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => handleHolidayToggle(holiday.name, e.target.checked)}
                            disabled={disabledHolidaysMutation.isPending}
                            className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                          <span className="text-sm text-gray-900">{holiday.name}</span>
                        </div>
                        <span className="text-sm text-gray-500">{formatted}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Odznacz święto, aby zezwolić na planowanie lekcji w ten dzień.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                Zapisz zmiany
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default OrganizationSettingsPage;
