import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, Save, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import organizationService from '../services/organizationService';

// Available metrics configuration
const AVAILABLE_METRICS = [
  { id: 'debtors', name: 'Dłużnicy', description: 'Uczniowie z przeterminowanymi płatnościami' },
  { id: 'pendingPayments', name: 'Oczekujące płatności', description: 'Płatności oczekujące na realizację' },
  { id: 'lessonsToday', name: 'Zajęcia dzisiaj', description: 'Liczba zaplanowanych zajęć na dziś' },
  { id: 'teachers', name: 'Lektorzy', description: 'Aktywni lektorzy w szkole' },
  { id: 'courses', name: 'Kursy aktywne', description: 'Liczba aktywnych kursów' },
  { id: 'students', name: 'Uczniowie', description: 'Aktywni uczniowie w szkole' },
] as const;

// Available charts configuration
const AVAILABLE_CHARTS = [
  { id: 'revenue', name: 'Przychody (ostatnie 30 dni)', description: 'Wykres przychodów z płatności' },
  { id: 'lessons', name: 'Zajęcia (ostatnie 30 dni)', description: 'Wykres liczby zajęć' },
] as const;

export type MetricId = typeof AVAILABLE_METRICS[number]['id'];
export type ChartId = typeof AVAILABLE_CHARTS[number]['id'];

export interface DashboardSettings {
  enabledMetrics: MetricId[];
  enabledCharts: ChartId[];
}

const DEFAULT_SETTINGS: DashboardSettings = {
  enabledMetrics: ['debtors', 'pendingPayments', 'lessonsToday', 'courses'],
  enabledCharts: ['revenue', 'lessons'],
};

const DashboardSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch organization to get current settings
  const { data: organization, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => organizationService.getOrganization(),
  });

  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);

  // Initialize settings from organization
  // settings is OrganizationSettings which has a settings field (Json) containing dashboard config
  useEffect(() => {
    const dashboardConfig = organization?.settings?.settings?.dashboard;
    if (dashboardConfig) {
      setSettings({
        enabledMetrics: (dashboardConfig.enabledMetrics as typeof DEFAULT_SETTINGS.enabledMetrics) || DEFAULT_SETTINGS.enabledMetrics,
        enabledCharts: (dashboardConfig.enabledCharts as typeof DEFAULT_SETTINGS.enabledCharts) || DEFAULT_SETTINGS.enabledCharts,
      });
    }
  }, [organization]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (dashboardSettings: DashboardSettings) => {
      const currentSettings = organization?.settings?.settings || {};
      return organizationService.updateOrganizationSettings({
        settings: {
          ...currentSettings,
          dashboard: dashboardSettings,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      toast.success('Ustawienia dashboardu zostały zapisane');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd podczas zapisywania ustawień');
    },
  });

  const handleMetricToggle = (metricId: MetricId) => {
    setSettings(prev => {
      const isEnabled = prev.enabledMetrics.includes(metricId);
      if (isEnabled) {
        return {
          ...prev,
          enabledMetrics: prev.enabledMetrics.filter(id => id !== metricId),
        };
      } else {
        return {
          ...prev,
          enabledMetrics: [...prev.enabledMetrics, metricId],
        };
      }
    });
  };

  const handleChartToggle = (chartId: ChartId) => {
    setSettings(prev => {
      const isEnabled = prev.enabledCharts.includes(chartId);
      if (isEnabled) {
        return {
          ...prev,
          enabledCharts: prev.enabledCharts.filter(id => id !== chartId),
        };
      } else {
        return {
          ...prev,
          enabledCharts: [...prev.enabledCharts, chartId],
        };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          Ustawienia Dashboardu
        </h1>
        <p className="mt-2 text-gray-600">Wybierz metryki i wykresy wyświetlane na dashboardzie</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Metrics Section */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Metryki</h2>
            <p className="text-sm text-gray-600 mb-4">
              Wybierz maksymalnie 4 metryki do wyświetlenia na górze dashboardu
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_METRICS.map((metric) => {
                const isEnabled = settings.enabledMetrics.includes(metric.id);
                const canEnable = isEnabled || settings.enabledMetrics.length < 4;

                return (
                  <label
                    key={metric.id}
                    className={`relative flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isEnabled
                        ? 'border-primary bg-primary/5'
                        : canEnable
                        ? 'border-gray-200 hover:border-gray-300'
                        : 'border-gray-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => canEnable && handleMetricToggle(metric.id)}
                        disabled={!canEnable}
                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                    </div>
                    <div className="ml-3 flex-1">
                      <span className="block text-sm font-medium text-gray-900">
                        {metric.name}
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        {metric.description}
                      </span>
                    </div>
                    {isEnabled && (
                      <GripVertical className="h-5 w-5 text-gray-400 ml-2" />
                    )}
                  </label>
                );
              })}
            </div>

            {settings.enabledMetrics.length === 0 && (
              <p className="mt-4 text-sm text-amber-600">
                Wybierz co najmniej jedną metrykę do wyświetlenia na dashboardzie
              </p>
            )}
          </div>
        </div>

        {/* Charts Section */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Wykresy</h2>
            <p className="text-sm text-gray-600 mb-4">
              Wybierz wykresy do wyświetlenia na dashboardzie
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AVAILABLE_CHARTS.map((chart) => {
                const isEnabled = settings.enabledCharts.includes(chart.id);

                return (
                  <label
                    key={chart.id}
                    className={`relative flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isEnabled
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => handleChartToggle(chart.id)}
                        className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                    </div>
                    <div className="ml-3 flex-1">
                      <span className="block text-sm font-medium text-gray-900">
                        {chart.name}
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        {chart.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateMutation.isPending || settings.enabledMetrics.length === 0}
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

export default DashboardSettingsPage;
