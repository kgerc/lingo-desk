import api from '../lib/api';

export interface CourseType {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  language: string;
  level: string;
  format: string;
  deliveryMode: string;
  defaultDurationMinutes: number;
  maxStudents?: number;
  pricePerLesson: number;
  createdAt: string;
  updatedAt: string;
  currency: string;
}

export interface CreateCourseTypeData {
  name: string;
  description?: string;
  language: string;
  level: string;
  format: string;
  deliveryMode: string;
  defaultDurationMinutes: number;
  maxStudents?: number;
  pricePerLesson: number;
}

export interface UpdateCourseTypeData {
  name?: string;
  description?: string;
  language?: string;
  level?: string;
  format?: string;
  deliveryMode?: string;
  defaultDurationMinutes?: number;
  maxStudents?: number;
  pricePerLesson?: number;
}

export const courseTypeService = {
  async getCourseTypes() {
    const response = await api.get('/course-types') as any;
    return response.data.data as CourseType[];
  },

  async getCourseTypeById(id: string) {
    const response = await api.get(`/course-types/${id}`) as any;
    return response.data.data as CourseType;
  },

  async createCourseType(data: CreateCourseTypeData) {
    const response = await api.post('/course-types', data) as any;
    return response.data.data as CourseType;
  },

  async updateCourseType(id: string, data: UpdateCourseTypeData) {
    const response = await api.put(`/course-types/${id}`, data) as any;
    return response.data.data as CourseType;
  },

  async deleteCourseType(id: string) {
    const response = await api.delete(`/course-types/${id}`);
    return response.data;
  },
};
