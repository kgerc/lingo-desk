import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { Users, GraduationCap, BookOpen, Calendar } from 'lucide-react';

const DashboardPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);

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

      {/* Alerts */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">
          ⚠️ Alerty
        </h3>
        <ul className="space-y-2 text-sm text-yellow-800">
          <li>• 3 uczniów ma końcący się budżet</li>
          <li>• 5 zajęć oczekuje na potwierdzenie przez lektora</li>
          <li>• 2 płatności zaległe</li>
        </ul>
      </div>
    </div>
  );
};

export default DashboardPage;
