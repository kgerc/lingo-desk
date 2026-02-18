import api from '../lib/api';

export type UserRole = 'ADMIN' | 'MANAGER' | 'HR' | 'METHODOLOGIST' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  avatarUrl?: string | null;
}

export interface UserWithProfile extends User {
  profile?: {
    address?: string | null;
    notes?: string | null;
  } | null;
}

export interface InviteUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'HR' | 'METHODOLOGIST' | 'TEACHER';
  phone?: string;
  password?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: Partial<Record<UserRole, number>>;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  HR: 'Kadrowy',
  METHODOLOGIST: 'Metodyk',
  TEACHER: 'Lektor',
  STUDENT: 'Uczeń',
  PARENT: 'Rodzic',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Pełny dostęp do wszystkich funkcji systemu',
  MANAGER: 'Zarządzanie szkołą, uczniami, lektorami i kursami',
  HR: 'Dostęp do płatności, wypłat lektorów i raportów finansowych',
  METHODOLOGIST: 'Dostęp do kursów, lekcji i materiałów dydaktycznych',
  TEACHER: 'Prowadzenie lekcji i dostęp do materiałów',
  STUDENT: 'Dostęp do własnych kursów i lekcji',
  PARENT: 'Dostęp do danych dzieci',
};

export const STAFF_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'HR', 'METHODOLOGIST', 'TEACHER'];
export const ASSIGNABLE_ROLES: UserRole[] = ['MANAGER', 'HR', 'METHODOLOGIST', 'TEACHER'];

export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  ADMIN: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
  MANAGER: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  HR: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
  METHODOLOGIST: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200' },
  TEACHER: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  STUDENT: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' },
  PARENT: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
};

const userService = {
  /**
   * Get all users with optional filters
   */
  async getUsers(filters?: UserFilters): Promise<User[]> {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.search) params.append('search', filters.search);

    const response = await api.get(`/users?${params.toString()}`) as any;
    return response.data.data;
  },

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserWithProfile> {
    const response = await api.get(`/users/${id}`) as any;
    return response.data.data;
  },

  /**
   * Invite a new user
   */
  async inviteUser(data: InviteUserData): Promise<User> {
    const response = await api.post('/users/invite', data) as any;
    return response.data.data;
  },

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    const response = await api.put(`/users/${id}`, data) as any;
    return response.data.data;
  },

  /**
   * Deactivate user
   */
  async deactivateUser(id: string): Promise<User> {
    const response = await api.post(`/users/${id}/deactivate`) as any;
    return response.data.data;
  },

  /**
   * Reactivate user
   */
  async reactivateUser(id: string): Promise<User> {
    const response = await api.post(`/users/${id}/reactivate`) as any;
    return response.data.data;
  },

  /**
   * Reset user password
   */
  async resetUserPassword(id: string): Promise<void> {
    await api.post(`/users/${id}/reset-password`);
  },

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    const response = await api.get('/users/stats') as any;
    return response.data.data;
  },
};

export default userService;
