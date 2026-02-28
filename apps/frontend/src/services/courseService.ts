import api from '../lib/api';

export interface Course {
  id: string;
  organizationId: string;
  teacherId: string;
  name: string;
  // Pola przeniesione z CourseType:
  courseType: 'GROUP' | 'INDIVIDUAL';
  language: string;
  level: string;
  deliveryMode: 'IN_PERSON' | 'ONLINE' | 'BOTH';
  defaultDurationMinutes: number;
  pricePerLesson: number;
  currency: string;
  description?: string;
  // Pozostałe pola:
  startDate: string;
  endDate?: string;
  isActive: boolean;
  locationId?: string;
  classroomId?: string;
  maxStudents?: number;
  onlineMeetingUrl?: string;
  currentStudentsCount: number;
  createdAt: string;
  updatedAt: string;
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
    status: string;
    paymentMode: 'PACKAGE' | 'PER_LESSON';
    hoursPurchased: number;
    hoursUsed: number;
  }>;
  lessons?: Array<{
    id: string;
    scheduledAt: string;
    status: string;
  }>;
}

export interface CreateCourseData {
  teacherId: string;
  name: string;
  // Pola przeniesione z CourseType:
  courseType: 'GROUP' | 'INDIVIDUAL';
  language: string;
  level: string;
  deliveryMode: 'IN_PERSON' | 'ONLINE' | 'BOTH';
  defaultDurationMinutes: number;
  pricePerLesson: number;
  currency: string;
  description?: string;
  // Pozostałe pola:
  startDate: string;
  endDate?: string;
  maxStudents?: number;
  onlineMeetingUrl?: string;
  locationId?: string;
  classroomId?: string;
  isActive?: boolean;
}

export interface UpdateCourseData {
  teacherId?: string;
  name?: string;
  // Pola przeniesione z CourseType:
  courseType?: 'GROUP' | 'INDIVIDUAL';
  language?: string;
  level?: string;
  deliveryMode?: 'IN_PERSON' | 'ONLINE' | 'BOTH';
  defaultDurationMinutes?: number;
  pricePerLesson?: number;
  currency?: string;
  description?: string;
  // Pozostałe pola:
  startDate?: string;
  endDate?: string;
  maxStudents?: number;
  onlineMeetingUrl?: string;
  locationId?: string;
  classroomId?: string;
  isActive?: boolean;
}

// Schedule item for creating lessons with course
export interface ScheduleItem {
  scheduledAt: string;
  durationMinutes: number;
  title?: string;
  deliveryMode: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string;
}

// Individual day schedule with time
export interface DayScheduleItem {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  time: string; // HH:mm format
}

// Pattern for recurring lessons in schedule
export interface SchedulePattern {
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  startDate: string;
  endDate?: string;
  occurrencesCount?: number;
  // Legacy: single time for all selected days
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  time?: string; // HH:mm format (used when daysOfWeek is set)
  // New: individual time per day
  daySchedules?: DayScheduleItem[]; // Each day has its own time
  durationMinutes: number;
  deliveryMode: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string;
}

export interface CreateCourseWithScheduleData extends CreateCourseData {
  schedule?: {
    items?: ScheduleItem[];
    pattern?: SchedulePattern;
  };
  studentIds?: string[];
}

export interface BulkUpdateLessonsData {
  teacherId?: string;
  durationMinutes?: number;
  deliveryMode?: 'IN_PERSON' | 'ONLINE';
  meetingUrl?: string | null;
  locationId?: string | null;
  classroomId?: string | null;
}

export interface CourseLessonForEdit {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  deliveryMode: string;
  canEdit: boolean;
  editBlockReason: string | null;
  teacher: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  student: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

export const courseService = {
  async getCourses(filters?: {
    search?: string;
    teacherId?: string;
    courseType?: 'GROUP' | 'INDIVIDUAL';
    isActive?: boolean;
  }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.teacherId) params.append('teacherId', filters.teacherId);
    if (filters?.courseType) params.append('courseType', filters.courseType);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const response = await api.get(`/courses?${params.toString()}`) as any;
    return response.data.data as Course[];
  },

  async getCourseById(id: string) {
    const response = await api.get(`/courses/${id}`) as any;
    return response.data.data as Course;
  },

  async createCourse(data: CreateCourseData) {
    const response = await api.post('/courses', data) as any;
    return response.data.data as Course;
  },

  async updateCourse(id: string, data: UpdateCourseData) {
    const response = await api.put(`/courses/${id}`, data) as any;
    return response.data.data as Course;
  },

  async getDeleteImpact(id: string) {
    const response = await api.get(`/courses/${id}/delete-impact`) as any;
    return response.data as {
      activeEnrollments: number;
      enrolledStudents: string[];
      futureLessons: number;
      pastLessons: number;
    };
  },

  async deleteCourse(id: string, force = false) {
    const response = await api.delete(`/courses/${id}${force ? '?force=true' : ''}`);
    return response.data;
  },

  async bulkDeleteCourses(ids: string[]) {
    const response = await api.delete('/courses/bulk', { data: { ids } });
    return response.data as { deleted: number; failed: number; errors: { id: string; error: string }[] };
  },

  async enrollStudent(
    courseId: string,
    studentId: string,
    paymentMode?: 'PACKAGE' | 'PER_LESSON',
    hoursPurchased?: number
  ) {
    const response = await api.post(`/courses/${courseId}/enroll`, {
      studentId,
      paymentMode,
      hoursPurchased,
    }) as any;
    return response.data.data;
  },

  async unenrollStudent(enrollmentId: string) {
    const response = await api.delete(`/courses/enrollments/${enrollmentId}`);
    return response.data;
  },

  async getStats() {
    const response = await api.get('/courses/stats') as any;
    return response.data.data as { total: number; active: number; withEnrollments: number };
  },

  async createCourseWithSchedule(data: CreateCourseWithScheduleData) {
    const response = await api.post('/courses/with-schedule', data) as any;
    return response.data.data as {
      course: Course;
      lessonsCreated: number;
      enrollmentsCreated: number;
      errors: Array<{ date: string; studentId: string; error: string }>;
      skippedHolidays: Array<{ date: string; holidayName: string }>;
    };
  },

  async getCourseLessonsForEdit(courseId: string) {
    const response = await api.get(`/courses/${courseId}/lessons`) as any;
    return response.data.data as CourseLessonForEdit[];
  },

  async bulkUpdateCourseLessons(courseId: string, updates: BulkUpdateLessonsData) {
    const response = await api.put(`/courses/${courseId}/lessons/bulk`, updates) as any;
    return response.data.data as { updated: number; message: string };
  },
};
