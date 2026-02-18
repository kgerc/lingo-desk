import api from '../lib/api';

export interface Teacher {
  id: string;
  userId: string;
  hourlyRate: number;
  contractType?: 'B2B' | 'EMPLOYMENT' | 'CIVIL' | null;
  specializations: string[];
  languages: string[];
  bio?: string;
  isAvailableForBooking: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    isActive: boolean;
    createdAt: string;
  };
  _count?: {
    courses: number;
    lessons: number;
  };
}

export interface CreateTeacherData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hourlyRate: number;
  contractType?: 'B2B' | 'EMPLOYMENT' | 'CIVIL';
  specializations?: string[];
  languages?: string[];
  bio?: string;
}

export interface UpdateTeacherData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  hourlyRate?: number;
  contractType?: 'B2B' | 'EMPLOYMENT' | 'CIVIL';
  specializations?: string[];
  languages?: string[];
  bio?: string;
  isAvailableForBooking?: boolean;
  isActive?: boolean;
}

export const teacherService = {
  async getMe() {
    const response = await api.get('/teachers/me') as any;
    return response.data.data as Teacher;
  },

  async getTeachers(filters?: {
    search?: string;
    isActive?: boolean;
    isAvailableForBooking?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters?.isAvailableForBooking !== undefined)
      params.append('isAvailableForBooking', String(filters.isAvailableForBooking));

    const response = await api.get(`/teachers?${params.toString()}`) as any;
    return response.data.data as Teacher[];
  },

  async getTeacherById(id: string) {
    const response = await api.get(`/teachers/${id}`) as any;
    return response.data.data as Teacher;
  },

  async createTeacher(data: CreateTeacherData) {
    const response = await api.post('/teachers', data) as any;
    return response.data.data as Teacher;
  },

  async updateTeacher(id: string, data: UpdateTeacherData) {
    const response = await api.put(`/teachers/${id}`, data) as any;
    return response.data.data as Teacher;
  },

  async deleteTeacher(id: string) {
    const response = await api.delete(`/teachers/${id}`);
    return response.data;
  },

  async bulkDeleteTeachers(ids: string[]) {
    const response = await api.delete('/teachers/bulk', { data: { ids } });
    return response.data as { deleted: number; failed: number; errors: { id: string; error: string }[] };
  },

  async getStats() {
    const response = await api.get('/teachers/stats') as any;
    return response.data.data as { total: number; active: number; available: number };
  },
};
