import api from '../lib/api';

export type LessonStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PENDING_CONFIRMATION'
  | 'NO_SHOW';

export type LessonDeliveryMode = 'IN_PERSON' | 'ONLINE';

export interface CancellationFeePreview {
  feeApplies: boolean;
  feeAmount: number | null;
  feePercent: number | null;
  hoursThreshold: number | null;
  hoursUntilLesson: number;
  lessonPrice: number | null;
  currency: string;
}

export interface CancellationStats {
  limitEnabled: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  period: string | null;
  periodStart: string | null;
  canCancel: boolean;
  cancelledLessons: Array<{
    id: string;
    title: string;
    scheduledAt: string;
    cancelledAt: string;
    cancellationReason: string | null;
    cancellationFeeApplied: boolean;
    cancellationFeeAmount: number | null;
  }>;
}

export interface Lesson {
  id: string;
  organizationId: string;
  courseId?: string;
  enrollmentId: string;
  teacherId: string;
  studentId: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  pricePerLesson?: number;
  currency?: string;
  locationId?: string;
  classroomId?: string;
  deliveryMode: LessonDeliveryMode;
  meetingUrl?: string;
  status: LessonStatus;
  isRecurring: boolean;
  recurringPatternId?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancellationFeeApplied?: boolean;
  cancellationFeeAmount?: number;
  cancellationFeePaymentId?: string;
  completedAt?: string;
  confirmedByTeacherAt?: string;
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
  student: {
    id: string;
    userId: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
    };
  };
  course?: {
    id: string;
    name: string;
    courseType: 'GROUP' | 'INDIVIDUAL';
    language: string;
    level: string;
  };
  enrollment: {
    id: string;
    courseId: string;
    studentId: string;
    isActive: boolean;
  };
  location?: {
    id: string;
    name: string;
    address: string;
  };
  classroom?: {
    id: string;
    name: string;
  };
  attendances?: Array<{
    id: string;
    studentId: string;
    status: string;
    notes?: string;
  }>;
}

export interface CreateLessonData {
  courseId?: string;
  enrollmentId?: string;
  teacherId: string;
  studentId: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  pricePerLesson?: number;
  currency?: string;
  locationId?: string;
  classroomId?: string;
  deliveryMode: LessonDeliveryMode;
  meetingUrl?: string;
  status?: LessonStatus;
  isRecurring?: boolean;
  recurringPatternId?: string;
}

export interface UpdateLessonData {
  title?: string;
  description?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  pricePerLesson?: number;
  currency?: string;
  locationId?: string;
  classroomId?: string;
  deliveryMode?: LessonDeliveryMode;
  meetingUrl?: string;
  status?: LessonStatus;
  cancellationReason?: string;
}

export const lessonService = {
  async getLessons(filters?: {
    search?: string;
    teacherId?: string;
    studentId?: string;
    courseId?: string;
    status?: LessonStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.teacherId) params.append('teacherId', filters.teacherId);
    if (filters?.studentId) params.append('studentId', filters.studentId);
    if (filters?.courseId) params.append('courseId', filters.courseId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/lessons?${params.toString()}`) as any;
    return response.data.data as Lesson[];
  },

  async getLessonById(id: string) {
    const response = await api.get(`/lessons/${id}`) as any;
    return response.data.data as Lesson;
  },

  async createLesson(data: CreateLessonData) {
    const response = await api.post('/lessons', data) as any;
    return response.data.data as Lesson;
  },

  async updateLesson(id: string, data: UpdateLessonData) {
    const response = await api.put(`/lessons/${id}`, data) as any;
    return response.data.data as Lesson;
  },

  async deleteLesson(id: string) {
    const response = await api.delete(`/lessons/${id}`);
    return response.data;
  },

  async confirmLesson(id: string) {
    const response = await api.post(`/lessons/${id}/confirm`) as any;
    return response.data.data as Lesson;
  },

  async getStats() {
    const response = await api.get('/lessons/stats') as any;
    return response.data.data as {
      total: number;
      scheduled: number;
      completed: number;
      cancelled: number;
      pendingConfirmation: number;
    };
  },

  async checkConflicts(
    teacherId: string,
    studentId: string,
    scheduledAt: string,
    durationMinutes: number,
    excludeLessonId?: string
  ) {
    const params = new URLSearchParams();
    params.append('teacherId', teacherId);
    params.append('studentId', studentId);
    params.append('scheduledAt', scheduledAt);
    params.append('durationMinutes', durationMinutes.toString());
    if (excludeLessonId) params.append('excludeLessonId', excludeLessonId);

    const response = await api.get(`/lessons/check-conflicts?${params.toString()}`) as any;
    return response.data.data as {
      hasConflicts: boolean;
      teacherConflicts: Array<{
        id: string;
        title: string;
        scheduledAt: string;
        durationMinutes: number;
        studentName: string;
      }>;
      studentConflicts: Array<{
        id: string;
        title: string;
        scheduledAt: string;
        durationMinutes: number;
        teacherName: string;
      }>;
    };
  },

  async createRecurringLessons(
    lessonData: CreateLessonData,
    pattern: {
      frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
      interval?: number;
      daysOfWeek?: number[];
      startDate: string;
      endDate?: string;
      occurrencesCount?: number;
    }
  ) {
    const response = await api.post('/lessons/recurring', { lessonData, pattern }) as any;
    return response.data.data as {
      recurringPattern: any;
      createdLessons: Lesson[];
      errors: Array<{ date: string; error: string }>;
      totalCreated: number;
      totalErrors: number;
    };
  },

  async getCancellationFeePreview(lessonId: string) {
    const response = await api.get(`/lessons/${lessonId}/cancellation-fee-preview`) as any;
    return response.data.data as CancellationFeePreview;
  },

  async getCancellationStats(studentId: string) {
    const response = await api.get(`/lessons/student/${studentId}/cancellation-stats`) as any;
    return response.data.data as CancellationStats;
  },

  async bulkUpdateStatus(lessonIds: string[], status: LessonStatus): Promise<{
    updated: number;
    failed: number;
    errors: Array<{ lessonId: string; title: string; error: string }>;
  }> {
    const response = await api.patch('/lessons/bulk-update-status', { lessonIds, status }) as any;
    return response.data.data;
  },
};
