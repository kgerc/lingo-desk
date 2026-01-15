import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { dashboardService, DashboardStats, DateRangeType, ChartDataParams } from '../services/dashboardService';
import organizationService from '../services/organizationService';
import { Users, GraduationCap, BookOpen, Calendar, TrendingUp, BarChart3, AlertTriangle, CreditCard, LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import StudentModal from '../components/StudentModal';
import CourseModal from '../components/CourseModal';
import LessonModal from '../components/LessonModal';

const MONTHS_PL = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

// Default settings if not configured
const DEFAULT_ENABLED_METRICS = ['debtors', 'pendingPayments', 'lessonsToday', 'courses'];
const DEFAULT_ENABLED_CHARTS = ['revenue', 'lessons'];

// Metric configuration type
interface MetricConfig {
  id: string;
  name: string;
  getValue: (stats: DashboardStats) => string;
  getSubtext?: (stats: DashboardStats) => string | null;
  icon: LucideIcon;
  color: string;
  textColor?: string;
}

// All available metrics
const ALL_METRICS: MetricConfig[] = [
  {
    id: 'debtors',
    name: 'Dłużnicy',
    getValue: (stats) => stats.debtors?.count?.toString() || '0',
    getSubtext: (stats) => stats.debtors?.totalAmount ? `${stats.debtors.totalAmount.toFixed(2)} PLN` : null,
    icon: AlertTriangle,
    color: 'bg-red-500',
    textColor: 'text-red-600',
  },
  {
    id: 'pendingPayments',
    name: 'Oczekujące płatności',
    getValue: (stats) => stats.pendingPayments?.count?.toString() || '0',
    getSubtext: (stats) => stats.pendingPayments?.totalAmount ? `${stats.pendingPayments.totalAmount.toFixed(2)} PLN` : null,
    icon: CreditCard,
    color: 'bg-amber-500',
    textColor: 'text-amber-600',
  },
  {
    id: 'lessonsToday',
    name: 'Zajęcia dzisiaj',
    getValue: (stats) => stats.lessonsToday?.toString() || '0',
    icon: Calendar,
    color: 'bg-primary',
  },
  {
    id: 'teachers',
    name: 'Lektorzy',
    getValue: (stats) => stats.teachers?.active?.toString() || '0',
    getSubtext: (stats) => stats.teachers?.total ? `z ${stats.teachers.total} całkowitych` : null,
    icon: GraduationCap,
    color: 'bg-primary',
  },
  {
    id: 'courses',
    name: 'Kursy aktywne',
    getValue: (stats) => stats.courses?.active?.toString() || '0',
    getSubtext: (stats) => stats.courses?.total ? `z ${stats.courses.total} całkowitych` : null,
    icon: BookOpen,
    color: 'bg-secondary',
  },
  {
    id: 'students',
    name: 'Uczniowie',
    getValue: (stats) => stats.students?.active?.toString() || '0',
    getSubtext: (stats) => stats.students?.total ? `z ${stats.students.total} całkowitych` : null,
    icon: Users,
    color: 'bg-secondary',
  },
];

const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  // Modals state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);

  // Chart date range state
  const currentDate = new Date();
  const [rangeType, setRangeType] = useState<DateRangeType>('last30days');
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1); // 1-12

  // Role-based dashboard rendering
  if (user?.role === 'TEACHER') {
    return <TeacherDashboard />;
  }

  if (user?.role === 'STUDENT') {
    return <StudentDashboard />;
  }

  if (user?.role === 'PARENT') {
    return <StudentDashboard />;
  }

  // ADMIN and MANAGER see the full dashboard below

  // Fetch organization to get dashboard settings
  const { data: organization } = useQuery({
    queryKey: ['organization'],
    queryFn: () => organizationService.getOrganization(),
  });

  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => dashboardService.getStats(),
    refetchInterval: 60000, // Refetch every minute
  });

  // Build chart query params
  const chartParams: ChartDataParams = useMemo(() => {
    const params: ChartDataParams = { rangeType };
    if (rangeType === 'month') {
      params.year = selectedYear;
      params.month = selectedMonth;
    } else if (rangeType === 'year') {
      params.year = selectedYear;
    }
    return params;
  }, [rangeType, selectedYear, selectedMonth]);

  // Fetch chart data
  const { data: chartData, isLoading: isLoadingCharts } = useQuery({
    queryKey: ['dashboardCharts', chartParams],
    queryFn: () => dashboardService.getChartData(chartParams),
  });

  // Get enabled metrics and charts from settings
  const enabledMetrics = useMemo(() => {
    return organization?.settings?.settings?.dashboard?.enabledMetrics || DEFAULT_ENABLED_METRICS;
  }, [organization]);

  const enabledCharts = useMemo(() => {
    return organization?.settings?.settings?.dashboard?.enabledCharts || DEFAULT_ENABLED_CHARTS;
  }, [organization]);

  // Filter metrics based on settings
  const visibleMetrics = useMemo(() => {
    return ALL_METRICS.filter(metric => enabledMetrics.includes(metric.id));
  }, [enabledMetrics]);

  if (isLoadingStats) {
    return <LoadingSpinner message="Ładowanie danych dashboardu..." />;
  }

  // Format revenue data for chart from new API
  const revenueData = chartData?.revenue.data.map(item => ({
    date: item.label,
    amount: item.amount || 0,
  })) || [];

  // Format lessons data for chart from new API
  const lessonsData = chartData?.lessons.data.map(item => ({
    date: item.label,
    count: item.count || 0,
  })) || [];

  // Get chart title based on range type
  const getChartRangeTitle = () => {
    if (rangeType === 'last30days') return 'ostatnie 30 dni';
    if (rangeType === 'month') return `${MONTHS_PL[selectedMonth - 1]} ${selectedYear}`;
    return `rok ${selectedYear}`;
  };

  // Navigation handlers for month/year
  const handlePrevPeriod = () => {
    if (rangeType === 'month') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else if (rangeType === 'year') {
      setSelectedYear(selectedYear - 1);
    }
  };

  const handleNextPeriod = () => {
    if (rangeType === 'month') {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    } else if (rangeType === 'year') {
      setSelectedYear(selectedYear + 1);
    }
  };

  const showRevenueChart = enabledCharts.includes('revenue');
  const showLessonsChart = enabledCharts.includes('lessons');

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Witaj, {user?.firstName}!
        </h1>
        <p className="mt-2 text-gray-600">
          Oto podsumowanie Twojej szkoły językowej
        </p>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-${Math.min(visibleMetrics.length, 4)} mb-8`}>
        {visibleMetrics.map((metric) => {
          const Icon = metric.icon;
          const value = dashboardStats ? metric.getValue(dashboardStats) : '0';
          const subtext = dashboardStats && metric.getSubtext ? metric.getSubtext(dashboardStats) : null;

          return (
            <div
              key={metric.id}
              className="bg-white rounded-lg shadow p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.name}</p>
                  <p className={`mt-2 text-3xl font-semibold ${metric.textColor || 'text-gray-900'}`}>
                    {value}
                  </p>
                  {subtext && (
                    <p className="text-xs text-gray-500 mt-1">{subtext}</p>
                  )}
                </div>
                <div className={`${metric.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      {(showRevenueChart || showLessonsChart) && (
        <div className="mb-8">
          {/* Date Range Picker */}
          <div className="bg-white rounded-lg shadow p-4 border border-gray-200 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Range Type Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Zakres:</span>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    onClick={() => setRangeType('last30days')}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      rangeType === 'last30days'
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Ostatnie 30 dni
                  </button>
                  <button
                    onClick={() => setRangeType('month')}
                    className={`px-3 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${
                      rangeType === 'month'
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Miesiąc
                  </button>
                  <button
                    onClick={() => setRangeType('year')}
                    className={`px-3 py-1.5 text-sm font-medium border-l border-gray-300 transition-colors ${
                      rangeType === 'year'
                        ? 'bg-primary text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Rok
                  </button>
                </div>
              </div>

              {/* Period Navigation (for month/year) */}
              {rangeType !== 'last30days' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrevPeriod}
                    className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                  </button>
                  <span className="text-sm font-medium text-gray-900 min-w-[140px] text-center">
                    {getChartRangeTitle()}
                  </span>
                  <button
                    onClick={handleNextPeriod}
                    className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Charts Grid */}
          <div className={`grid grid-cols-1 ${showRevenueChart && showLessonsChart ? 'lg:grid-cols-2' : ''} gap-6`}>
            {/* Revenue Chart */}
            {showRevenueChart && (
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Przychody ({getChartRangeTitle()})
                  </h2>
                </div>
                {isLoadingCharts ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <LoadingSpinner message="Ładowanie..." />
                  </div>
                ) : revenueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number | undefined) => value !== undefined ? `${value.toFixed(2)} PLN` : 'N/A'}
                        labelStyle={{ color: '#000' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: '#10b981', r: 4 }}
                        activeDot={{ r: 6 }}
                        name="Przychód"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-500">
                    Brak danych o przychodach
                  </div>
                )}
                {chartData?.revenue.total !== undefined && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      Łączny przychód: <span className="font-bold text-secondary">
                        {chartData.revenue.total.toFixed(2)} PLN
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Lessons Chart */}
            {showLessonsChart && (
              <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Zajęcia ({getChartRangeTitle()})
                  </h2>
                </div>
                {isLoadingCharts ? (
                  <div className="h-[250px] flex items-center justify-center">
                    <LoadingSpinner message="Ładowanie..." />
                  </div>
                ) : lessonsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={lessonsData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value: number | undefined) => value !== undefined ? `${value} zajęć` : 'N/A'}
                        labelStyle={{ color: '#000' }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                        name="Liczba zajęć"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-500">
                    Brak danych o zajęciach
                  </div>
                )}
                {chartData?.lessons.total !== undefined && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      Łączna liczba zajęć: <span className="font-bold text-primary">
                        {chartData.lessons.total}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Szybkie akcje
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button
            onClick={() => setIsStudentModalOpen(true)}
            className="px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
          >
            + Dodaj ucznia
          </button>
          <button
            onClick={() => setIsLessonModalOpen(true)}
            className="px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
          >
            + Dodaj zajęcia
          </button>
          <button
            onClick={() => setIsCourseModalOpen(true)}
            className="px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
          >
            + Dodaj kurs
          </button>
        </div>
      </div>


      {/* Modals */}
      {isStudentModalOpen && (
        <StudentModal
          student={null}
          onClose={() => setIsStudentModalOpen(false)}
          onSuccess={() => {
            setIsStudentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
          }}
        />
      )}

      {isCourseModalOpen && (
        <CourseModal
          course={null}
          onClose={() => setIsCourseModalOpen(false)}
          onSuccess={() => {
            setIsCourseModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
          }}
        />
      )}

      {isLessonModalOpen && (
        <LessonModal
          lesson={null}
          onClose={() => setIsLessonModalOpen(false)}
          onSuccess={() => {
            setIsLessonModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
