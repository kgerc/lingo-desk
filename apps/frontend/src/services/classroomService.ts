import api from '../lib/api';

export interface Location {
  id: string;
  name: string;
  address?: string;
  isActive: boolean;
  classrooms?: Classroom[];
}

export interface Classroom {
  id: string;
  locationId: string;
  name: string;
  capacity?: number;
  isActive: boolean;
  location?: {
    id: string;
    name: string;
    address?: string;
  };
}

const classroomService = {
  // ─── Classrooms ───────────────────────────────────────────────────────────

  async getClassrooms(options?: { locationId?: string; isActive?: boolean }): Promise<Classroom[]> {
    const params = new URLSearchParams();
    if (options?.locationId) params.append('locationId', options.locationId);
    if (options?.isActive !== undefined) params.append('isActive', String(options.isActive));

    const response = await api.get(`/classrooms?${params.toString()}`) as any;
    return response.data.data;
  },

  async getClassroomById(id: string): Promise<Classroom> {
    const response = await api.get(`/classrooms/${id}`) as any;
    return response.data.data;
  },

  async createClassroom(data: { locationId: string; name: string; capacity?: number }): Promise<Classroom> {
    const response = await api.post('/classrooms', data) as any;
    return response.data.data;
  },

  async updateClassroom(
    id: string,
    data: { name?: string; capacity?: number; isActive?: boolean; locationId?: string }
  ): Promise<Classroom> {
    const response = await api.put(`/classrooms/${id}`, data) as any;
    return response.data.data;
  },

  async deleteClassroom(id: string): Promise<void> {
    await api.delete(`/classrooms/${id}`);
  },

  async checkConflict(params: {
    classroomId: string;
    scheduledAt: string;
    durationMinutes: number;
    excludeLessonId?: string;
  }): Promise<{ hasConflict: boolean; conflictingLessons: any[] }> {
    const query = new URLSearchParams({
      classroomId: params.classroomId,
      scheduledAt: params.scheduledAt,
      durationMinutes: String(params.durationMinutes),
    });
    if (params.excludeLessonId) query.append('excludeLessonId', params.excludeLessonId);

    const response = await api.get(`/classrooms/conflict-check?${query.toString()}`) as any;
    return response.data.data;
  },

  // ─── Locations ────────────────────────────────────────────────────────────

  async getLocations(options?: { isActive?: boolean }): Promise<Location[]> {
    const params = new URLSearchParams();
    if (options?.isActive !== undefined) params.append('isActive', String(options.isActive));

    const response = await api.get(`/classrooms/locations?${params.toString()}`) as any;
    return response.data.data;
  },

  async createLocation(data: { name: string; address?: string }): Promise<Location> {
    const response = await api.post('/classrooms/locations', data) as any;
    return response.data.data;
  },

  async updateLocation(id: string, data: { name?: string; address?: string; isActive?: boolean }): Promise<Location> {
    const response = await api.put(`/classrooms/locations/${id}`, data) as any;
    return response.data.data;
  },

  async deleteLocation(id: string): Promise<void> {
    await api.delete(`/classrooms/locations/${id}`);
  },
};

export default classroomService;
