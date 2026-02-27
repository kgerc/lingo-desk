import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import organizationService, { PaymentReminderSettings } from '../services/organizationService';
import { Bell, Save, Info } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

const DEFAULT_SETTINGS: PaymentReminderSettings = {
  paymentReminderEnabled: false,
  paymentReminderDaysBefore: [7, 3, 1],
  paymentReminderDaysAfter: [1, 3, 7],
  paymentReminderMinIntervalHours: 24,
};

export default function PaymentSettingsTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['organization-settings'],
    queryFn: () => organizationService.getOrganizationSettings(),
  });

  const [formData, setFormData] = useState<PaymentReminderSettings>(DEFAULT_SETTINGS);
  const [daysBeforeInput, setDaysBeforeInput] = useState('7, 3, 1');
  const [daysAfterInput, setDaysAfterInput] = useState('1, 3, 7');
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (settings) {
      const data: PaymentReminderSettings = {
        paymentReminderEnabled: settings.paymentReminderEnabled ?? false,
        paymentReminderDaysBefore: settings.paymentReminderDaysBefore ?? [7, 3, 1],
        paymentReminderDaysAfter: settings.paymentReminderDaysAfter ?? [1, 3, 7],
        paymentReminderMinIntervalHours: settings.paymentReminderMinIntervalHours ?? 24,
      };
      setFormData(data);
      setDaysBeforeInput(data.paymentReminderDaysBefore.join(', '));
      setDaysAfterInput(data.paymentReminderDaysAfter.join(', '));
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: PaymentReminderSettings) =>
      organizationService.updateOrganizationSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
      toast.success('Ustawienia przypomnień zostały zapisane');
    },
    onError: () => {
      toast.error('Błąd podczas zapisywania ustawień');
    },
  });

  const parseDaysInput = (input: string): number[] | null => {
    const parts = input.split(',').map((s) => s.trim()).filter(Boolean);
    const nums = parts.map(Number);
    if (nums.some((n) => isNaN(n) || n < 0 || !Number.isInteger(n))) return null;
    return nums;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.paymentReminderEnabled) {
      const before = parseDaysInput(daysBeforeInput);
      if (!before || before.length === 0) {
        newErrors.daysBefore = 'Podaj prawidłowe liczby dni (np. 7, 3, 1)';
      }
      const after = parseDaysInput(daysAfterInput);
      if (!after || after.length === 0) {
        newErrors.daysAfter = 'Podaj prawidłowe liczby dni (np. 1, 3, 7)';
      }
      if (!formData.paymentReminderMinIntervalHours || formData.paymentReminderMinIntervalHours < 1) {
        newErrors.minInterval = 'Minimalny interwał musi być co najmniej 1 godzina';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const daysBefore = parseDaysInput(daysBeforeInput) ?? formData.paymentReminderDaysBefore;
    const daysAfter = parseDaysInput(daysAfterInput) ?? formData.paymentReminderDaysAfter;

    updateMutation.mutate({
      ...formData,
      paymentReminderDaysBefore: daysBefore,
      paymentReminderDaysAfter: daysAfter,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">Terminy płatności per uczeń</p>
          <p>
            Indywidualny termin płatności ucznia (dni po lekcji lub konkretny dzień miesiąca)
            ustawiasz w <strong>profilu ucznia</strong>. Tutaj konfigurujesz globalne ustawienia
            przypomnień o płatnościach dla całej organizacji.
          </p>
        </div>
      </div>

      {/* Payment Reminders Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Bell className="w-5 h-5 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-900">Automatyczne przypomnienia o płatnościach</h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-700">Włącz automatyczne przypomnienia</p>
              <p className="text-xs text-gray-500 mt-0.5">
                System wysyła e-mail do uczniów z nieopłaconymi płatnościami
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
              <input
                type="checkbox"
                checked={formData.paymentReminderEnabled}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentReminderEnabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {formData.paymentReminderEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Days before */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dni <span className="text-primary font-semibold">przed</span> terminem płatności
                </label>
                <input
                  type="text"
                  value={daysBeforeInput}
                  onChange={(e) => {
                    setDaysBeforeInput(e.target.value);
                    if (errors.daysBefore) setErrors((prev) => { const e = { ...prev }; delete e.daysBefore; return e; });
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.daysBefore ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="np. 7, 3, 1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Przypomnienie wysyłane tyle dni przed terminem (oddziel przecinkami)
                </p>
                {errors.daysBefore && <p className="mt-1 text-sm text-red-600">{errors.daysBefore}</p>}
              </div>

              {/* Days after */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dni <span className="text-red-600 font-semibold">po</span> terminie płatności (zaległości)
                </label>
                <input
                  type="text"
                  value={daysAfterInput}
                  onChange={(e) => {
                    setDaysAfterInput(e.target.value);
                    if (errors.daysAfter) setErrors((prev) => { const e = { ...prev }; delete e.daysAfter; return e; });
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.daysAfter ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="np. 1, 3, 7"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Przypomnienie wysyłane tyle dni po terminie (oddziel przecinkami)
                </p>
                {errors.daysAfter && <p className="mt-1 text-sm text-red-600">{errors.daysAfter}</p>}
              </div>

              {/* Min interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimalny interwał między przypomnieniami (godziny)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.paymentReminderMinIntervalHours}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, paymentReminderMinIntervalHours: parseInt(e.target.value) || 1 }));
                    if (errors.minInterval) setErrors((prev) => { const e = { ...prev }; delete e.minInterval; return e; });
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    errors.minInterval ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Zapobiega wysyłaniu zbyt częstych przypomnień do tego samego ucznia
                </p>
                {errors.minInterval && <p className="mt-1 text-sm text-red-600">{errors.minInterval}</p>}
              </div>

              {/* Summary */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-2">
                <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 space-y-1">
                  <p className="font-medium">Jak działają przypomnienia:</p>
                  <p>• System sprawdza codziennie o godz. 9:00</p>
                  <p>• Wysyła e-mail do uczniów z należnościami</p>
                  <p>• Nie wysyła ponownie przed upływem interwału</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz ustawienia'}
        </button>
      </div>
    </form>
  );
}
