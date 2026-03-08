import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, XCircle, RefreshCw, Video } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { googleCalendarService } from '../services/googleCalendarService';
import { teamsService } from '../services/teamsService';
import toast from 'react-hot-toast';

const IntegrationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle OAuth callbacks from both Google and Microsoft
  useEffect(() => {
    const gcStatus = searchParams.get('google_calendar');
    const msStatus = searchParams.get('microsoft_teams');

    if (gcStatus === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarStatus'] });
      toast.success('Google Calendar połączony pomyślnie');
      setSearchParams({});
    } else if (gcStatus === 'error') {
      toast.error('Błąd podczas łączenia z Google Calendar');
      setSearchParams({});
    }

    if (msStatus === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['microsoftTeamsStatus'] });
      toast.success('Microsoft Teams połączony pomyślnie');
      setSearchParams({});
    } else if (msStatus === 'error') {
      toast.error('Błąd podczas łączenia z Microsoft Teams');
      setSearchParams({});
    }
  }, [searchParams, queryClient, setSearchParams]);

  // ---- Google Calendar queries/mutations ----
  const { data: gcStatus, isLoading: gcLoading } = useQuery({
    queryKey: ['googleCalendarStatus'],
    queryFn: () => googleCalendarService.getSyncStatus(),
  });

  const gcConnectMutation = useMutation({
    mutationFn: () => googleCalendarService.connect(),
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: () => toast.error('Błąd podczas łączenia z Google Calendar'),
  });

  const gcDisconnectMutation = useMutation({
    mutationFn: () => googleCalendarService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarStatus'] });
      toast.success('Google Calendar rozłączony');
    },
    onError: () => toast.error('Błąd podczas rozłączania Google Calendar'),
  });

  const gcSyncMutation = useMutation({
    mutationFn: () => googleCalendarService.syncFromGoogleCalendar(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarStatus'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      const synced = data?.lessonsSynced?.synced ?? 0;
      toast.success(`Synchronizacja zakończona. Zsynchronizowano ${synced} lekcji`);
    },
    onError: () => toast.error('Błąd podczas synchronizacji'),
  });

  // ---- Microsoft Teams queries/mutations ----
  const { data: teamsStatus, isLoading: teamsLoading } = useQuery({
    queryKey: ['microsoftTeamsStatus'],
    queryFn: () => teamsService.getSyncStatus(),
  });

  const teamsConnectMutation = useMutation({
    mutationFn: () => teamsService.connect(),
    onSuccess: (data) => { window.location.href = data.authUrl; },
    onError: () => toast.error('Błąd podczas łączenia z Microsoft Teams'),
  });

  const teamsDisconnectMutation = useMutation({
    mutationFn: () => teamsService.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microsoftTeamsStatus'] });
      toast.success('Microsoft Teams rozłączony');
    },
    onError: () => toast.error('Błąd podczas rozłączania Microsoft Teams'),
  });

  const handleGcDisconnect = () => {
    if (window.confirm('Czy na pewno chcesz rozłączyć Google Calendar?')) {
      gcDisconnectMutation.mutate();
    }
  };

  const handleTeamsDisconnect = () => {
    if (window.confirm('Czy na pewno chcesz rozłączyć Microsoft Teams?')) {
      teamsDisconnectMutation.mutate();
    }
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
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 rounded-lg flex-shrink-0">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Google Calendar</h3>
            <p className="mt-1 text-sm text-gray-600">
              Synchronizuj lekcje z Google Calendar
            </p>

            {gcLoading ? (
              <div className="mt-4 text-sm text-gray-500">Ładowanie...</div>
            ) : gcStatus?.connected ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Połączono</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {gcStatus.calendarId && (
                    <div><span className="font-medium">Kalendarz:</span> {gcStatus.calendarId}</div>
                  )}
                  {gcStatus.lastSyncAt && (
                    <div>
                      <span className="font-medium">Ostatnia synchronizacja:</span>{' '}
                      {new Date(gcStatus.lastSyncAt).toLocaleString('pl-PL')}
                    </div>
                  )}
                  {gcStatus.connectedAt && (
                    <div>
                      <span className="font-medium">Data połączenia:</span>{' '}
                      {new Date(gcStatus.connectedAt).toLocaleString('pl-PL')}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => gcSyncMutation.mutate()}
                    disabled={gcSyncMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${gcSyncMutation.isPending ? 'animate-spin' : ''}`} />
                    Synchronizuj teraz
                  </button>
                  <button
                    onClick={handleGcDisconnect}
                    disabled={gcDisconnectMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    {gcDisconnectMutation.isPending ? 'Rozłączanie...' : 'Rozłącz'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  onClick={() => gcConnectMutation.mutate()}
                  disabled={gcConnectMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  {gcConnectMutation.isPending ? 'Łączenie...' : 'Połącz z Google Calendar'}
                </button>
              </div>
            )}
          </div>
        </div>

        {gcStatus?.connected && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Jak to działa?</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Lekcje tworzone w aplikacji są automatycznie dodawane do Google Calendar</li>
              <li>Zmiany lekcji w aplikacji są synchronizowane z Google Calendar</li>
              <li>Usunięcie lub anulowanie lekcji usuwa wydarzenie z Google Calendar</li>
              <li>Student jest dodawany jako uczestnik wydarzenia w kalendarzu</li>
            </ul>
          </div>
        )}
      </div>

      {/* Microsoft Teams Integration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 rounded-lg flex-shrink-0">
            <Video className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Microsoft Teams</h3>
            <p className="mt-1 text-sm text-gray-600">
              Automatycznie twórz spotkania Teams dla lekcji online
            </p>

            {teamsLoading ? (
              <div className="mt-4 text-sm text-gray-500">Ładowanie...</div>
            ) : teamsStatus?.connected ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Połączono</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {teamsStatus.email && (
                    <div><span className="font-medium">Konto Microsoft:</span> {teamsStatus.email}</div>
                  )}
                  {teamsStatus.lastSyncAt && (
                    <div>
                      <span className="font-medium">Ostatnia aktywność:</span>{' '}
                      {new Date(teamsStatus.lastSyncAt).toLocaleString('pl-PL')}
                    </div>
                  )}
                  {teamsStatus.connectedAt && (
                    <div>
                      <span className="font-medium">Data połączenia:</span>{' '}
                      {new Date(teamsStatus.connectedAt).toLocaleString('pl-PL')}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleTeamsDisconnect}
                    disabled={teamsDisconnectMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                    {teamsDisconnectMutation.isPending ? 'Rozłączanie...' : 'Rozłącz'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  onClick={() => teamsConnectMutation.mutate()}
                  disabled={teamsConnectMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Video className="h-4 w-4" />
                  {teamsConnectMutation.isPending ? 'Łączenie...' : 'Połącz z Microsoft Teams'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Wymaga konta Microsoft 365 z licencją Teams
                </p>
              </div>
            )}
          </div>
        </div>

        {teamsStatus?.connected && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Jak to działa?</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Nowe lekcje online automatycznie otrzymują spotkanie Microsoft Teams</li>
              <li>Link do spotkania Teams jest widoczny w szczegółach lekcji</li>
              <li>Zmiany czasu lekcji są synchronizowane ze spotkaniem Teams</li>
              <li>Anulowanie lub usunięcie lekcji usuwa powiązane spotkanie Teams</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationsPage;
