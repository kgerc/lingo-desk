import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import userProfileService, { NotificationPreferences } from '../services/userProfileService';
import { Bell, Mail, MessageSquare, CreditCard, AlertTriangle, Save } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const NotificationSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({});

  // Fetch current preferences
  const { data: currentPreferences, isLoading } = useQuery({
    queryKey: ['notificationPreferences'],
    queryFn: () => userProfileService.getNotificationPreferences(),
    onSuccess: (data) => {
      setPreferences(data);
    },
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: (data: NotificationPreferences) =>
      userProfileService.updateNotificationPreferences(data),
    onSuccess: () => {
      toast.success('Ustawienia powiadomień zostały zapisane');
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.error?.message || 'Wystąpił błąd podczas zapisywania ustawień';
      toast.error(errorMessage);
    },
  });

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(preferences);
  };

  const handleReset = () => {
    if (currentPreferences) {
      setPreferences(currentPreferences);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie ustawień..." />;
  }

  const notificationOptions = [
    {
      key: 'emailReminders' as keyof NotificationPreferences,
      title: 'Przypomnienia o lekcjach',
      description: 'Otrzymuj emaile z przypomnieniami 24 godziny przed lekcją',
      icon: Bell,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      key: 'emailConfirmations' as keyof NotificationPreferences,
      title: 'Potwierdzenia lekcji',
      description: 'Email z potwierdzeniem gdy lektor potwierdzi lekcję',
      icon: MessageSquare,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      key: 'emailCancellations' as keyof NotificationPreferences,
      title: 'Powiadomienia o anulowaniu',
      description: 'Email gdy lekcja zostanie anulowana',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      key: 'emailPayments' as keyof NotificationPreferences,
      title: 'Potwierdzenia płatności',
      description: 'Email z potwierdzeniem po dokonaniu płatności',
      icon: CreditCard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      key: 'emailLowBudget' as keyof NotificationPreferences,
      title: 'Alerty o niskim budżecie',
      description: 'Email gdy zostanie mało godzin na koncie',
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      key: 'inAppNotifications' as keyof NotificationPreferences,
      title: 'Powiadomienia w aplikacji',
      description: 'Wyświetlaj powiadomienia bezpośrednio w aplikacji',
      icon: Bell,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ustawienia powiadomień</h1>
        <p className="mt-2 text-gray-600">
          Zarządzaj swoimi preferencjami dotyczącymi powiadomień email i w aplikacji
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Typy powiadomień</h2>
          </div>
        </div>

        {/* Notification Options */}
        <div className="divide-y divide-gray-200">
          {notificationOptions.map((option) => {
            const Icon = option.icon;
            const isEnabled = preferences[option.key] ?? true;

            return (
              <div
                key={option.key}
                className="px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${option.bgColor}`}>
                      <Icon className={`h-5 w-5 ${option.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{option.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{option.description}</p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggle(option.key)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                      isEnabled ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="px-6 py-4 bg-blue-50 border-t border-gray-200">
          <p className="text-sm text-blue-900">
            <strong>Uwaga:</strong> Nawet gdy powiadomienia email są wyłączone, będziesz nadal
            otrzymywać ważne wiadomości dotyczące bezpieczeństwa konta i zmian w systemie.
          </p>
        </div>

        {/* Action Buttons */}
        {hasChanges && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <p className="text-sm text-gray-600">Masz niezapisane zmiany</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="mt-6 bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Zarządzanie powiadomieniami</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Możesz w każdej chwili zmienić swoje preferencje</li>
          <li>• Powiadomienia SMS są dostępne tylko gdy podasz numer telefonu</li>
          <li>• Wszystkie emaile zawierają link do wypisania się z powiadomień</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
