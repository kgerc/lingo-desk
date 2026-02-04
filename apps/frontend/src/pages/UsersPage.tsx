import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Users,
  UserPlus,
  Search,
  MoreVertical,
  Mail,
  Phone,
  Shield,
  UserX,
  UserCheck,
  KeyRound,
  Edit,
  X,
} from 'lucide-react';
import userService, {
  User,
  UserRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_COLORS,
  STAFF_ROLES,
  ASSIGNABLE_ROLES,
} from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuthStore } from '../stores/authStore';

// Invite User Modal
interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'TEACHER' as 'ADMIN' | 'MANAGER' | 'HR' | 'METHODOLOGIST' | 'TEACHER',
    phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inviteMutation = useMutation({
    mutationFn: userService.inviteUser,
    onSuccess: () => {
      toast.success('Zaproszenie zostało wysłane');
      onSuccess();
      onClose();
      setFormData({ email: '', firstName: '', lastName: '', role: 'TEACHER', phone: '' });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Nie udało się wysłać zaproszenia');
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.email) newErrors.email = 'Email jest wymagany';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Nieprawidłowy format email';
    if (!formData.firstName || formData.firstName.length < 2) newErrors.firstName = 'Imię musi mieć min. 2 znaki';
    if (!formData.lastName || formData.lastName.length < 2) newErrors.lastName = 'Nazwisko musi mieć min. 2 znaki';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      inviteMutation.mutate(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Zaproś użytkownika</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="jan.kowalski@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imię *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Jan"
              />
              {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Kowalski"
              />
              {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="+48 123 456 789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rola *</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as typeof formData.role })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {ASSIGNABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">{ROLE_DESCRIPTIONS[formData.role]}</p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {inviteMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Wyślij zaproszenie
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit User Modal
interface EditUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    role: user?.role || 'TEACHER',
  });

  React.useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        role: user.role,
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => userService.updateUser(id, data),
    onSuccess: () => {
      toast.success('Użytkownik został zaktualizowany');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Nie udało się zaktualizować użytkownika');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      updateMutation.mutate({
        id: user.id,
        data: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone || null,
          role: formData.role,
        },
      });
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Edytuj użytkownika</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imię</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {(['ADMIN', 'MANAGER', 'HR', 'METHODOLOGIST', 'TEACHER', 'STUDENT', 'PARENT'] as UserRole[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// User Row Actions Menu
interface UserActionsMenuProps {
  user: User;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  onResetPassword: () => void;
  currentUserId: string;
}

const UserActionsMenu: React.FC<UserActionsMenuProps> = ({
  user,
  onEdit,
  onDeactivate,
  onReactivate,
  onResetPassword,
  currentUserId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isCurrentUser = user.id === currentUserId;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            <button
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Edytuj
            </button>
            <button
              onClick={() => {
                onResetPassword();
                setIsOpen(false);
              }}
              disabled={isCurrentUser}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <KeyRound className="h-4 w-4" />
              Resetuj hasło
            </button>
            {user.isActive ? (
              <button
                onClick={() => {
                  onDeactivate();
                  setIsOpen(false);
                }}
                disabled={isCurrentUser}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserX className="h-4 w-4" />
                Dezaktywuj
              </button>
            ) : (
              <button
                onClick={() => {
                  onReactivate();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                Aktywuj
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Main UsersPage Component
const UsersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, variant: 'warning' });

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', roleFilter, statusFilter, searchQuery],
    queryFn: () =>
      userService.getUsers({
        role: roleFilter || undefined,
        isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
        search: searchQuery || undefined,
      }),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['userStats'],
    queryFn: userService.getUserStats,
  });

  // Mutations
  const deactivateMutation = useMutation({
    mutationFn: userService.deactivateUser,
    onSuccess: () => {
      toast.success('Użytkownik został dezaktywowany');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Nie udało się dezaktywować użytkownika');
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: userService.reactivateUser,
    onSuccess: () => {
      toast.success('Użytkownik został aktywowany');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Nie udało się aktywować użytkownika');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: userService.resetUserPassword,
    onSuccess: () => {
      toast.success('Nowe hasło zostało wysłane na email użytkownika');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Nie udało się zresetować hasła');
    },
  });

  const handleDeactivate = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Dezaktywuj użytkownika',
      message: `Czy na pewno chcesz dezaktywować użytkownika ${user.firstName} ${user.lastName}? Użytkownik nie będzie mógł się zalogować.`,
      onConfirm: () => deactivateMutation.mutate(user.id),
      variant: 'danger',
    });
  };

  const handleReactivate = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Aktywuj użytkownika',
      message: `Czy na pewno chcesz aktywować użytkownika ${user.firstName} ${user.lastName}?`,
      onConfirm: () => reactivateMutation.mutate(user.id),
      variant: 'warning',
    });
  };

  const handleResetPassword = (user: User) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Resetuj hasło',
      message: `Czy na pewno chcesz zresetować hasło użytkownika ${user.firstName} ${user.lastName}? Nowe tymczasowe hasło zostanie wysłane na email.`,
      onConfirm: () => resetPasswordMutation.mutate(user.id),
      variant: 'warning',
    });
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie użytkowników..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-600" />
          Użytkownicy
        </h1>
        <p className="mt-2 text-gray-600">Zarządzanie użytkownikami i rolami w organizacji</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600">Wszyscy użytkownicy</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600">Aktywni</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600">Nieaktywni</p>
            <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600">Personel</p>
            <p className="text-2xl font-bold text-blue-600">
              {(stats.byRole.ADMIN || 0) +
                (stats.byRole.MANAGER || 0) +
                (stats.byRole.HR || 0) +
                (stats.byRole.METHODOLOGIST || 0) +
                (stats.byRole.TEACHER || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Szukaj po imieniu, nazwisku lub email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Wszystkie role</option>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
            <option value="STUDENT">Uczeń</option>
            <option value="PARENT">Rodzic</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Wszyscy</option>
            <option value="active">Aktywni</option>
            <option value="inactive">Nieaktywni</option>
          </select>

          {/* Invite Button */}
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <UserPlus className="h-5 w-5" />
            Zaproś użytkownika
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Brak użytkowników</h3>
            <p className="text-gray-600 mb-4">Nie znaleziono użytkowników spełniających kryteria wyszukiwania.</p>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <UserPlus className="h-5 w-5" />
              Zaproś pierwszego użytkownika
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Użytkownik
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kontakt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rola
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ostatnie logowanie
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => {
                const roleColors = ROLE_COLORS[user.role];
                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${!user.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                          {user.firstName[0]}
                          {user.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Phone className="h-4 w-4" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors.bg} ${roleColors.text} border ${roleColors.border}`}
                      >
                        <Shield className="h-3 w-3" />
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                          Aktywny
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          Nieaktywny
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <UserActionsMenu
                        user={user}
                        currentUserId={currentUser?.id || ''}
                        onEdit={() => setEditingUser(user)}
                        onDeactivate={() => handleDeactivate(user)}
                        onReactivate={() => handleReactivate(user)}
                        onResetPassword={() => handleResetPassword(user)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          queryClient.invalidateQueries({ queryKey: ['userStats'] });
        }}
      />

      <EditUserModal
        user={editingUser}
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
      />
    </div>
  );
};

export default UsersPage;
