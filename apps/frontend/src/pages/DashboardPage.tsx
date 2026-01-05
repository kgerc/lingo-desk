import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { studentService } from '../services/studentService';
import { Users, GraduationCap, BookOpen, Calendar, AlertTriangle } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

  // Fetch low budget alerts
  const { data: lowBudgetAlerts = [] } = useQuery({
    queryKey: ['lowBudgetAlerts'],
    queryFn: () => studentService.getStudentsWithLowBudget(),
    refetchInterval: 60000, // Refetch every minute
  });

  const stats = [
    { name: 'Uczniowie', value: '156', icon: Users, color: 'bg-secondary' },
    { name: 'Lektorzy', value: '12', icon: GraduationCap, color: 'bg-primary' },
    { name: 'Kursy aktywne', value: '24', icon: BookOpen, color: 'bg-secondary' },
    { name: 'Zajęcia dzisiaj', value: '18', icon: Calendar, color: 'bg-primary' },
  ];

  return (
    <div>
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
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Szybkie akcje
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <button className="px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm">
            + Dodaj ucznia
          </button>
          <button className="px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm">
            + Dodaj zajęcia
          </button>
          <button className="px-4 py-3 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm">
            + Dodaj kurs
          </button>
        </div>
      </div>

      {/* Budget Alerts */}
      {lowBudgetAlerts.length > 0 && (
        <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-6">
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
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
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
    </div>
  );
};

export default DashboardPage;
