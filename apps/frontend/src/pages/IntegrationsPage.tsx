import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { googleCalendarService } from '../services/googleCalendarService';

const IntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check for OAuth callback parameters
  useEffect(() => {
    const status = searchParams.get('google_calendar');
    if (status === 'connected') {
      // Refresh status after successful connection
      queryClient.invalidateQueries({ queryKey: ['googleCalendarStatus'] });
      // Clear URL params
      setSearchParams({});
    } else if (status === 'error') {
      alert('Błąd podczas łączenia z Google Calendar');
      setSearchParams({});
    }
  }, [searchParams, queryClient, setSearchParams]);

  // Get Google Calendar sync status
  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['googleCalendarStatus'],
    queryFn: () => googleCalendarService.getSyncStatus(),
  });

  // Connect to Google Calendar
  const connectMutation = useMutation({
    mutationFn: () => googleCalendarService.connect(),
    onSuccess: (data) => {
      // Redirect to Google OAuth page
      window.location.href = data.authUrl;
    },
    onError: (error) => {
      console.error('Error connecting to Google Calendar:', error);
      alert('Błąd podczas łączenia z Google Calendar');
    },
  });

  // Disconnect from Google Calendar
  const disconnectMutation = useMutation({
    mutationFn: () => googleCalendarService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarStatus'] });
      alert('Google Calendar został rozłączony');
    },
    onError: (error) => {
      console.error('Error disconnecting from Google Calendar:', error);
      alert('Błąd podczas rozłączania Google Calendar');
    },
  });

  // Manual sync
  const syncMutation = useMutation({
    mutationFn: () => googleCalendarService.syncFromGoogleCalendar(),
    onSuccess: (data) => {
      const lessonsResult = data?.lessonsSynced;
      const externalResult = data?.externalEventsImported;

      let message = 'Synchronizacja zakończona pomyślnie!\n\n';

      if (lessonsResult) {
        message += `Lekcje:\n`;
        message += `  Zsynchronizowano: ${lessonsResult.synced}\n`;
        message += `  Niepowodzenia: ${lessonsResult.failed}\n`;
        message += `  Razem: ${lessonsResult.total}\n`;
      }

      if (externalResult) {
        message += `\nOsobiste wydarzenia:\n`;
        message += `  Zaimportowano: ${externalResult.imported}\n`;
        message += `  Niepowodzenia: ${externalResult.failed}\n`;
        message += `  Razem: ${externalResult.total}`;
      }

      if (!lessonsResult && !externalResult) {
        message = 'Synchronizacja zakończona pomyślnie';
      }

      alert(message);
      queryClient.invalidateQueries({ queryKey: ['googleCalendarStatus'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['externalEvents'] });
    },
    onError: (error) => {
      console.error('Error syncing:', error);
      alert('Błąd podczas synchronizacji');
    },
  });

  const handleConnect = () => {
    connectMutation.mutate();
  };

  const handleDisconnect = () => {
    if (window.confirm('Czy na pewno chcesz rozłączyć Google Calendar?')) {
      disconnectMutation.mutate();
    }
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Integracje</h2>
        <p className="mt-1 text-sm text-gray-600">
          Zarządzaj integracjami z zewnętrznymi serwisami
        </p>
      </div>

      {/* Google Calendar Integration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Google Calendar</h3>
              <p className="mt-1 text-sm text-gray-600">
                Synchronizuj lekcje z Google Calendar
              </p>

              {isLoading ? (
                <div className="mt-4 text-sm text-gray-500">Ładowanie...</div>
              ) : syncStatus?.connected ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-600">
                      Połączono
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      <span className="font-medium">Kalendarz:</span>{' '}
                      {syncStatus.calendarId}
                    </div>
                    {syncStatus.lastSyncAt && (
                      <div>
                        <span className="font-medium">Ostatnia synchronizacja:</span>{' '}
                        {new Date(syncStatus.lastSyncAt).toLocaleString('pl-PL')}
                      </div>
                    )}
                    {syncStatus.connectedAt && (
                      <div>
                        <span className="font-medium">Data połączenia:</span>{' '}
                        {new Date(syncStatus.connectedAt).toLocaleString('pl-PL')}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSync}
                      disabled={syncMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                    >
                      <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                      Synchronizuj teraz
                    </button>

                    <button
                      onClick={handleDisconnect}
                      disabled={disconnectMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Rozłącz
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <button
                    onClick={handleConnect}
                    disabled={connectMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50"
                  >
                    <Calendar className="h-4 w-4" />
                    Połącz z Google Calendar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feature Description */}
        {syncStatus?.connected && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">
              Jak to działa?
            </h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Lekcje tworzone w aplikacji są automatycznie dodawane do Google Calendar</li>
              <li>Zmiany lekcji w aplikacji są synchronizowane z Google Calendar</li>
              <li>Usunięcie lub anulowanie lekcji usuwa wydarzenie z Google Calendar</li>
              <li>Zmiany w Google Calendar są synchronizowane z aplikacją</li>
              <li>Student jest dodawany jako uczestnik wydarzenia w kalendarzu</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationsPage;
