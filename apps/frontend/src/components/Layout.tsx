import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import OrganizationSwitcher from './OrganizationSwitcher';
import alertService from '../services/alertService';
import {
  Home,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  Calendar,
  Clock,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Bell,
  BarChart3,
  Mail,
  UserCog,
  ClipboardList,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { isCollapsed, toggleSidebar } = useSidebarStore();
  const queryClient = useQueryClient();
  const location = useLocation();

  // Fetch unread alerts count (with auto-generation for admin/manager)
  const { data: unreadCount } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      // Generate system alerts only for admin/manager (org-wide alerts)
      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        await alertService.generateSystemAlerts();
      }
      return await alertService.getUnreadCount();
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Role-based navigation (without Settings)
  const getNavigationForRole = () => {
    const role = user?.role;

    // Common items for all roles
    const commonItems = [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
    ];

    // Role-specific items (Settings moved to bottom)
    switch (role) {
      case 'ADMIN':
      case 'MANAGER':
        return [
          ...commonItems,
          { name: 'Alerty', href: '/alerts', icon: Bell, badge: unreadCount || 0 },
          { name: 'Użytkownicy', href: '/users', icon: UserCog },
          { name: 'Uczniowie', href: '/students', icon: Users },
          { name: 'Lektorzy', href: '/teachers', icon: GraduationCap },
          { name: 'Kursy', href: '/courses', icon: BookOpen },
          // { name: 'Grupy', href: '/groups', icon: Users2 }, // Hidden temporarily
          { name: 'Materiały', href: '/materials', icon: FileText },
          { name: 'Grafik', href: '/lessons', icon: Clock },
          { name: 'Zgłoszenia', href: '/applications', icon: ClipboardList },
          { name: 'Rozliczenia', href: '/payments', icon: CreditCard },
          { name: 'Dłużnicy', href: '/debtors', icon: AlertCircle },
          { name: 'Mailing', href: '/mailing', icon: Mail },
          { name: 'Raporty', href: '/reports', icon: BarChart3 },
        ];

      case 'TEACHER':
        return [
          ...commonItems,
          { name: 'Alerty', href: '/alerts', icon: Bell, badge: unreadCount || 0 },
          { name: 'Mój grafik', href: '/teacher/schedule', icon: Calendar },
          { name: 'Moje lekcje', href: '/lessons', icon: BookOpen },
          { name: 'Uczniowie', href: '/students', icon: Users },
        ];

      case 'STUDENT':
        return [
          ...commonItems,
          { name: 'Alerty', href: '/alerts', icon: Bell, badge: unreadCount || 0 },
          { name: 'Moje lekcje', href: '/lessons', icon: Clock },
          { name: 'Moje kursy', href: '/courses', icon: BookOpen },
          { name: 'Grafik', href: '/calendar', icon: Calendar },
          { name: 'Wpłaty', href: '/payments?tab=payments', icon: CreditCard },
        ];

      case 'PARENT':
        return [
          ...commonItems,
          { name: 'Dzieci', href: '/students', icon: Users },
          { name: 'Grafik', href: '/lessons', icon: Clock },
          { name: 'Wpłaty', href: '/payments?tab=payments', icon: CreditCard },
        ];

      default:
        return commonItems;
    }
  };

  const navigation = getNavigationForRole();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-secondary border-r border-secondary/20 flex flex-col transition-[width] duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
        style={{ willChange: 'width' }}
      >
        {/* Logo */}
        <div className="h-20 flex items-center border-b border-secondary/20 flex-shrink-0 px-3.5">
          <div className="flex items-center gap-3">
            {/* Stały kontener logo */}
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
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

            {/* Nazwa – tylko opacity */}
            <h1
              className={`text-2xl font-bold text-white whitespace-nowrap transition-opacity duration-200 ${
                isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              LingoDesk
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {navigation.map((item) => {
            const Icon = item.icon;
            const hasBadge = 'badge' in item && item.badge && item.badge > 0;
            return (
              <Link
                key={item.name}
                to={item.href}
                title={isCollapsed ? item.name : ''}
                className={`flex items-center px-2 py-3 rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-white/80 hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-8 flex justify-center relative">
                    <Icon className="h-5 w-5" />
                  </div>

                  <span
                    className={`font-medium whitespace-nowrap transition-opacity duration-200 flex-1 ${
                      isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    {item.name}
                  </span>

                  {hasBadge && !isCollapsed && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section: Settings + Toggle */}
        <div className="p-4 border-t border-secondary/20 space-y-1 flex-shrink-0 overflow-x-hidden">
          {/* Settings - ADMIN/MANAGER mają dostęp do pełnych ustawień z zakładkami */}
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') ? (
            <Link
              to="/settings"
              title={isCollapsed ? 'Ustawienia' : ''}
              className={`flex items-center px-2 py-3 rounded-lg transition-colors ${
                isActive('/settings')
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 flex justify-center">
                  <Settings className="h-5 w-5" />
                </div>
                <span
                  className={`font-medium whitespace-nowrap transition-opacity duration-200 ${
                    isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  Ustawienia
                </span>
              </div>
            </Link>
          ) : (
            /* Dla innych ról - tylko link do powiadomień */
            <Link
              to="/settings/notifications"
              title={isCollapsed ? 'Powiadomienia' : ''}
              className={`flex items-center px-2 py-3 rounded-lg transition-colors ${
                isActive('/settings/notifications')
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 flex justify-center">
                  <Bell className="h-5 w-5" />
                </div>
                <span
                  className={`font-medium whitespace-nowrap transition-opacity duration-200 ${
                    isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  Powiadomienia
                </span>
              </div>
            </Link>
          )}

          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            title={isCollapsed ? 'Rozwiń sidebar' : 'Zwiń sidebar'}
            className="w-full flex items-center px-2 py-3 rounded-lg transition-colors text-white/80 hover:bg-white/5 hover:text-white"
          >
            <div className="flex items-center gap-3">
              {/* Stała kolumna na ikonę */}
              <div className="w-8 flex justify-center">
                {isCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </div>

              {/* Tekst – tylko opacity */}
              <span
                className={`font-medium whitespace-nowrap transition-opacity duration-200 ${
                  isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
              >
                Zwiń
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* Sticky Header */}
      <header
        className={`fixed top-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm transition-[left] duration-300 ease-in-out ${
          isCollapsed ? 'left-20' : 'left-64'
        }`}
        style={{ willChange: 'left' }}
      >
        <div className="flex items-center justify-between px-8 py-4">
          <div className="flex-1"></div>

          <div className="flex items-center gap-4">
            {/* 🔽 Organization Switcher */}
            <OrganizationSwitcher />

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
                onClick={() => { queryClient.clear(); logout(); }}
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
      <main
        className={`pt-16 transition-[padding-left] duration-300 ease-in-out ${
          isCollapsed ? 'pl-20' : 'pl-64'
        }`}
        style={{ willChange: 'padding-left' }}
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
