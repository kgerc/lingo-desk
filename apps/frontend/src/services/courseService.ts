import api from '../lib/api';

export interface Course {
  id: string;
  organizationId: string;
  courseTypeId: string;
  teacherId: string;
  name: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  locationId?: string;
  classroomId?: string;
  maxStudents?: number;
  currentStudentsCount: number;
  createdAt: string;
  updatedAt: string;
  courseType: {
    id: string;
    name: string;
    language: string;
    level: string;
    format: string;
    deliveryMode: string;
    pricePerLesson: number;
  };
  teacher: {
    id: string;
    userId: string;
    hourlyRate: number;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
    };
  };
  _count?: {
    enrollments: number;
    lessons: number;
  };
  enrollments?: Array<{
    id: string;
    studentId: string;
    isActive: boolean;
    student: {
      id: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        avatarUrl?: string;
      };
    };
  }>;
  lessons?: Array<{
    id: string;
    scheduledAt: string;
    status: string;
  }>;
}

export interface CreateCourseData {
  courseTypeId: string;
  teacherId: string;
  name: string;
  startDate: string;
  endDate?: string;
  maxStudents?: number;
  locationId?: string;
  classroomId?: string;
  isActive?: boolean;
}

export interface UpdateCourseData {
  teacherId?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  maxStudents?: number;
  locationId?: string;
  classroomId?: string;
  isActive?: boolean;
}

export const courseService = {
  async getCourses(filters?: {
    search?: string;
    teacherId?: string;
    courseTypeId?: string;
    isActive?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.teacherId) params.append('teacherId', filters.teacherId);
    if (filters?.courseTypeId) params.append('courseTypeId', filters.courseTypeId);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const response = await api.get(`/courses?${params.toString()}`);
    return response.data.data as Course[];
  },

  async getCourseById(id: string) {
    const response = await api.get(`/courses/${id}`);
    return response.data.data as Course;
  },

  async createCourse(data: CreateCourseData) {
    const response = await api.post('/courses', data);
    return response.data.data as Course;
  },

  async updateCourse(id: string, data: UpdateCourseData) {
    const response = await api.put(`/courses/${id}`, data);
    return response.data.data as Course;
  },

  async deleteCourse(id: string) {
    const response = await api.delete(`/courses/${id}`);
    return response.data;
  },

  async enrollStudent(courseId: string, studentId: string) {
    const response = await api.post(`/courses/${courseId}/enroll`, { studentId });
    return response.data.data;
  },

  async unenrollStudent(enrollmentId: string) {
    const response = await api.delete(`/courses/enrollments/${enrollmentId}`);
    return response.data;
  },

  async getStats() {
    const response = await api.get('/courses/stats');
    return response.data.data as { total: number; active: number; withEnrollments: number };
  },
};
