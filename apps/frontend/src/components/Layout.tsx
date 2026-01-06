import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import NotificationBell from './NotificationBell';
import {
  Home,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Clock,
  CreditCard,
  Settings,
  LogOut,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  // Role-based navigation
  const getNavigationForRole = () => {
    const role = user?.role;

    // Common items for all roles
    const commonItems = [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
    ];

    // Role-specific items
    switch (role) {
      case 'ADMIN':
      case 'MANAGER':
        return [
          ...commonItems,
          { name: 'Uczniowie', href: '/students', icon: Users },
          { name: 'Lektorzy', href: '/teachers', icon: GraduationCap },
          { name: 'Kursy', href: '/courses', icon: BookOpen },
          { name: 'Lekcje', href: '/lessons', icon: Clock },
          { name: 'Grafik', href: '/calendar', icon: Calendar },
          { name: 'Płatności', href: '/payments', icon: CreditCard },
          { name: 'Ustawienia', href: '/settings', icon: Settings },
        ];

      case 'TEACHER':
        return [
          ...commonItems,
          { name: 'Mój grafik', href: '/teacher/schedule', icon: Calendar },
          { name: 'Dostępność', href: '/teacher/availability', icon: Clock },
          { name: 'Moje lekcje', href: '/lessons', icon: BookOpen },
          { name: 'Uczniowie', href: '/students', icon: Users },
          { name: 'Ustawienia', href: '/settings', icon: Settings },
        ];

      case 'STUDENT':
        return [
          ...commonItems,
          { name: 'Moje lekcje', href: '/lessons', icon: Clock },
          { name: 'Moje kursy', href: '/courses', icon: BookOpen },
          { name: 'Grafik', href: '/calendar', icon: Calendar },
          { name: 'Płatności', href: '/payments', icon: CreditCard },
          { name: 'Ustawienia', href: '/settings', icon: Settings },
        ];

      case 'PARENT':
        return [
          ...commonItems,
          { name: 'Dzieci', href: '/students', icon: Users },
          { name: 'Lekcje', href: '/lessons', icon: Clock },
          { name: 'Płatności', href: '/payments', icon: CreditCard },
          { name: 'Ustawienia', href: '/settings', icon: Settings },
        ];

      default:
        return commonItems;
    }
  };

  const navigation = getNavigationForRole();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-secondary border-r border-secondary/20">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-secondary/20">
          <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <img
              src="/lingodesk_logo_medium.png"
              alt="LingoDesk Logo"
              className="h-full w-full object-cover scale-150 ml-1 mt-1"
              onError={(e) => {
                console.error('Logo failed to load');
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="text-xl font-bold text-white">LingoDesk</h1>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Sticky Header */}
      <header className="fixed top-0 left-64 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex-1"></div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <NotificationBell />

            {/* User Menu */}
            <div className="flex items-center gap-3 border-l border-gray-200 pl-4">
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-white font-semibold text-sm">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'ADMIN' && 'Administrator'}
                  {user?.role === 'MANAGER' && 'Manager'}
                  {user?.role === 'TEACHER' && 'Lektor'}
                  {user?.role === 'STUDENT' && 'Uczeń'}
                  {user?.role === 'PARENT' && 'Rodzic'}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Wyloguj"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pl-64 pt-16">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
