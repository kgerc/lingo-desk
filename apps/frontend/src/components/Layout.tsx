import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useSidebarStore } from '../stores/sidebarStore';
import OrganizationSwitcher from './OrganizationSwitcher';
import alertService from '../services/alertService';
import userProfileService from '../services/userProfileService';
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
  Building2,
  GripVertical,
  RotateCcw,
  Check,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

interface LayoutProps {
  children: React.ReactNode;
}

function getDefaultNavItems(role: string | undefined): NavItem[] {
  const commonItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
  ];
  switch (role) {
    case 'ADMIN':
    case 'MANAGER':
      return [
        ...commonItems,
        { name: 'Alerty', href: '/alerts', icon: Bell },
        { name: 'Użytkownicy', href: '/users', icon: UserCog },
        { name: 'Uczniowie', href: '/students', icon: Users },
        { name: 'Lektorzy', href: '/teachers', icon: GraduationCap },
        { name: 'Kursy', href: '/courses', icon: BookOpen },
        { name: 'Materiały', href: '/materials', icon: FileText },
        { name: 'Grafik', href: '/lessons', icon: Clock },
        { name: 'Sale', href: '/classrooms', icon: Building2 },
        { name: 'Zgłoszenia', href: '/applications', icon: ClipboardList },
        { name: 'Rozliczenia', href: '/payments', icon: CreditCard },
        { name: 'Dłużnicy', href: '/debtors', icon: AlertCircle },
        { name: 'Mailing', href: '/mailing', icon: Mail },
        { name: 'Raporty', href: '/reports', icon: BarChart3 },
      ];
    case 'TEACHER':
      return [
        ...commonItems,
        { name: 'Alerty', href: '/alerts', icon: Bell },
        { name: 'Mój grafik', href: '/teacher/schedule', icon: Calendar },
        { name: 'Moje lekcje', href: '/lessons', icon: BookOpen },
        { name: 'Uczniowie', href: '/students', icon: Users },
      ];
    case 'STUDENT':
      return [
        ...commonItems,
        { name: 'Alerty', href: '/alerts', icon: Bell },
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
}

function readLocalSidebarOrder(userId: string, defaults: NavItem[]): NavItem[] | null {
  try {
    const raw = localStorage.getItem(`sidebar-order-${userId}`);
    if (!raw) return null;
    const saved: string[] = JSON.parse(raw);
    const ordered: NavItem[] = [];
    for (const name of saved) {
      const item = defaults.find((i) => i.name === name);
      if (item) ordered.push(item);
    }
    for (const item of defaults) {
      if (!ordered.find((o) => o.name === item.name)) ordered.push(item);
    }
    return ordered.length > 0 ? ordered : null;
  } catch {
    return null;
  }
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { data: organization } = useQuery({
    queryKey: ['organization'],
    queryFn: () => import('../services/organizationService').then(m => m.default.getOrganization()),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const { isCollapsed, toggleSidebar } = useSidebarStore();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Fetch unread alerts count (with auto-generation for admin/manager)
  const { data: unreadCount } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        await alertService.generateSystemAlerts();
      }
      return await alertService.getUnreadCount();
    },
    refetchInterval: 60000,
  });

  // Navigation order state — initialize from localStorage for instant render
  const [navItems, setNavItems] = useState<NavItem[]>(() => {
    const { user: initialUser } = useAuthStore.getState();
    const defaults = getDefaultNavItems(initialUser?.role);
    if (!initialUser?.id) return defaults;
    return readLocalSidebarOrder(initialUser.id, defaults) ?? defaults;
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const draggingName = useRef<string | null>(null);

  // Load saved sidebar order from backend
  const { data: savedOrder } = useQuery({
    queryKey: ['sidebar-order'],
    queryFn: () => userProfileService.getSidebarOrder(),
    enabled: !!user,
    staleTime: Infinity,
  });

  // Save sidebar order mutation
  const saveMutation = useMutation({
    mutationFn: (order: string[]) => {
      if (user?.id) {
        localStorage.setItem(`sidebar-order-${user.id}`, JSON.stringify(order));
      }
      return userProfileService.saveSidebarOrder(order);
    },
    onSuccess: () => {
      toast.success('Układ sidebaru zapisany');
      queryClient.invalidateQueries({ queryKey: ['sidebar-order'] });
      setIsEditMode(false);
    },
    onError: () => {
      toast.error('Błąd podczas zapisywania układu');
    },
  });

  // Apply saved order from backend and sync to localStorage
  useEffect(() => {
    // savedOrder undefined means query hasn't resolved yet — don't touch navItems
    if (savedOrder === undefined) return;
    const defaults = getDefaultNavItems(user?.role);
    if (savedOrder && savedOrder.length > 0) {
      if (user?.id) {
        localStorage.setItem(`sidebar-order-${user.id}`, JSON.stringify(savedOrder));
      }
      const ordered: NavItem[] = [];
      for (const name of savedOrder) {
        const item = defaults.find((i) => i.name === name);
        if (item) ordered.push(item);
      }
      for (const item of defaults) {
        if (!ordered.find((o) => o.name === item.name)) ordered.push(item);
      }
      setNavItems(ordered);
    }
    // savedOrder null/empty and no localStorage — set defaults
    else if (!user?.id || !localStorage.getItem(`sidebar-order-${user.id}`)) {
      setNavItems(defaults);
    }
  }, [savedOrder, user?.role]);

  // Update badges without reordering
  useEffect(() => {
    setNavItems((prev) =>
      prev.map((item) => {
        if (item.href === '/alerts') return { ...item, badge: unreadCount || 0 };
        return item;
      })
    );
  }, [unreadCount]);

  const handleDragStart = (name: string, e: React.DragEvent) => {
    if (!isEditMode) {
      e.preventDefault();
      return;
    }
    draggingName.current = name;
    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    ghost.style.width = '1px';
    ghost.style.height = '1px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const handleDragEnter = (targetName: string) => {
    const fromName = draggingName.current;
    if (!fromName || fromName === targetName) return;
    setNavItems((prev) => {
      const fromIdx = prev.findIndex((i) => i.name === fromName);
      const toIdx = prev.findIndex((i) => i.name === targetName);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleDragEnd = () => {
    draggingName.current = null;
  };

  const handleSaveOrder = () => {
    saveMutation.mutate(navItems.map((i) => i.name));
  };

  const handleResetOrder = () => {
    const defaults = getDefaultNavItems(user?.role);
    setNavItems(defaults);
    saveMutation.mutate(defaults.map((i) => i.name));
  };

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
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
              {organization?.logoUrl ? (
                <img
                  src={organization.logoUrl}
                  alt={organization.name}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <img
                  src="/lingodesk_logo_medium.png"
                  alt="LingoDesk Logo"
                  className="h-full w-full object-cover scale-150 ml-1 mt-1"
                />
              )}
            </div>

            {/* Nazwa – tylko opacity */}
            <h1
              className={`text-xl font-bold text-white whitespace-nowrap transition-opacity duration-200 ${
                isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
              }`}
            >
              {organization?.name || 'LingoDesk'}
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {/* Edit mode toolbar */}
          {!isCollapsed && (
            <div
              className={`flex items-center gap-2 mb-2 transition-all duration-200 overflow-hidden ${
                isEditMode ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              <button
                onClick={handleSaveOrder}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-green-500 hover:bg-green-400 text-white text-xs font-medium transition-colors"
              >
                <Check className="w-3 h-3" />
                Zapisz
              </button>
              <button
                onClick={handleResetOrder}
                disabled={saveMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 text-xs font-medium transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
              <button
                onClick={() => setIsEditMode(false)}
                className="ml-auto text-white/50 hover:text-white/80 text-xs"
              >
                Anuluj
              </button>
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const hasBadge = item.badge && item.badge > 0;
            return (
              <div
                key={item.name}
                draggable={isEditMode}
                onDragStart={(e) => handleDragStart(item.name, e)}
                onDragEnter={() => handleDragEnter(item.name)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                className={isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}
              >
                <Link
                  to={isEditMode ? '#' : item.href}
                  onClick={isEditMode ? (e) => e.preventDefault() : undefined}
                  draggable={false}
                  title={isCollapsed ? item.name : ''}
                  className={`flex items-center px-2 py-3 rounded-lg transition-colors ${
                    isEditMode
                      ? 'bg-white/5 text-white/70 hover:bg-white/10'
                      : isActive(item.href)
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/80 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {isEditMode && !isCollapsed && (
                    <GripVertical className="h-4 w-4 text-white/40 mr-1 flex-shrink-0" />
                  )}
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
                    {hasBadge && !isCollapsed && !isEditMode && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            );
          })}

          {/* Edit order button */}
          {!isCollapsed && !isEditMode && (
            <button
              onClick={() => setIsEditMode(true)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors text-xs mt-2"
            >
              <div className="w-8 flex justify-center">
                <GripVertical className="h-4 w-4" />
              </div>
              Zmień kolejność
            </button>
          )}
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
                onClick={() => { logout(); }}
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
