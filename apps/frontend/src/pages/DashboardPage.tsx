import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { studentService } from '../services/studentService';
import { dashboardService } from '../services/dashboardService';
import { Users, GraduationCap, BookOpen, Calendar, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TeacherDashboard from './TeacherDashboard';
import StudentDashboard from './StudentDashboard';
import StudentModal from '../components/StudentModal';
import CourseModal from '../components/CourseModal';
import LessonModal from '../components/LessonModal';

const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  // Modals state
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);

  // Role-based dashboard rendering
  if (user?.role === 'TEACHER') {
    return <TeacherDashboard />;
  }

  if (user?.role === 'STUDENT') {
    return <StudentDashboard />;
  }

  if (user?.role === 'PARENT') {
    // Parent dashboard can be similar to Student but for multiple children
    return <StudentDashboard />;
  }

  // ADMIN and MANAGER see the full dashboard below

  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => dashboardService.getStats(),
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch low budget alerts
  const { data: lowBudgetAlerts = [] } = useQuery({
    queryKey: ['lowBudgetAlerts'],
    queryFn: () => studentService.getStudentsWithLowBudget(),
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoadingStats) {
    return <LoadingSpinner message="Ładowanie danych dashboardu..." />;
  }

  const stats = [
    {
      name: 'Uczniowie',
      value: dashboardStats?.students.active.toString() || '0',
      total: dashboardStats?.students.total || 0,
      icon: Users,
      color: 'bg-secondary'
    },
    {
      name: 'Lektorzy',
      value: dashboardStats?.teachers.active.toString() || '0',
      total: dashboardStats?.teachers.total || 0,
      icon: GraduationCap,
      color: 'bg-primary'
    },
    {
      name: 'Kursy aktywne',
      value: dashboardStats?.courses.active.toString() || '0',
      total: dashboardStats?.courses.total || 0,
      icon: BookOpen,
      color: 'bg-secondary'
    },
    {
      name: 'Zajęcia dzisiaj',
      value: dashboardStats?.lessonsToday.toString() || '0',
      icon: Calendar,
      color: 'bg-primary'
    },
  ];

  // Format revenue data for chart
  const revenueData = dashboardStats?.revenue.last30Days.map(item => ({
    date: new Date(item.date).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' }),
    amount: item.amount,
  })) || [];

  // Format lessons data for chart
  const lessonsData = dashboardStats?.lessonsLast30Days.map(item => ({
    date: new Date(item.date).toLocaleDateString('pl-PL', { month: 'short', day: 'numeric' }),
    count: item.count,
  })) || [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Witaj, {user?.firstName}! 👋
        </h1>
        <p className="mt-2 text-gray-600">
          Oto podsumowanie Twojej szkoły językowej
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white rounded-lg shadow p-6 border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                  {stat.total !== undefined && stat.name !== 'Zajęcia dzisiaj' && (
                    <p className="text-xs text-gray-500 mt-1">z {stat.total} całkowitych</p>
                  )}
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Chart */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-secondary" />
            <h2 className="text-xl font-semibold text-gray-900">
              Przychody (ostatnie 30 dni)
            </h2>
          </div>
          {revenueData.length > 0 ? (
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
          {dashboardStats?.revenue.total !== undefined && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Łączny przychód: <span className="font-bold text-secondary">
                  {dashboardStats.revenue.total.toFixed(2)} PLN
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Lessons Chart */}
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-gray-900">
              Zajęcia (ostatnie 30 dni)
            </h2>
          </div>
          {lessonsData.length > 0 ? (
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
        </div>
      </div>

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

      {/* Budget Alerts */}
      {lowBudgetAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">
              Alerty budżetowe ({lowBudgetAlerts.length})
            </h3>
          </div>
          <div className="space-y-3">
            {lowBudgetAlerts.map((alert) => (
              <div
                key={alert.enrollmentId}
                className="bg-white border border-red-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {alert.studentName}
                    </p>
                    <p className="text-xs text-gray-600">
                      Kurs: {alert.courseName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-red-600">
                      {alert.hoursRemaining.toFixed(1)}h
                    </p>
                    <p className="text-xs text-gray-500">pozostało</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Alerts */}
      {lowBudgetAlerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-2">
            <div className="text-green-600 text-2xl">✓</div>
            <div>
              <h3 className="text-lg font-semibold text-green-900">
                Brak alertów budżetowych
              </h3>
              <p className="text-sm text-green-700 mt-1">
                Wszyscy uczniowie mają wystarczający budżet godzin
              </p>
            </div>
          </div>
        </div>
      )}

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
