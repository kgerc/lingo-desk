import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
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
          { name: 'Moje lekcje', href: '/lessons', icon: Clock },
          { name: 'Grafik', href: '/calendar', icon: Calendar },
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
        <div className="h-24 flex items-center gap-2 px-5 border-b border-secondary/20">
          <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
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
          <h1 className="text-2xl font-bold text-white">LingoDesk</h1>
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

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-secondary/20 bg-secondary">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-white/60 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 text-white/60 hover:text-white transition-colors"
              title="Wyloguj"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
          {/* Role badge */}
          <div className="flex justify-start">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
              {user?.role === 'ADMIN' && 'Administrator'}
              {user?.role === 'MANAGER' && 'Manager'}
              {user?.role === 'TEACHER' && 'Lektor'}
              {user?.role === 'STUDENT' && 'Uczeń'}
              {user?.role === 'PARENT' && 'Rodzic'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
