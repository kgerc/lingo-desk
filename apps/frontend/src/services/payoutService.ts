import api from '../lib/api';

export type TeacherPayoutStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
export type QualificationReason = 'COMPLETED' | 'CONFIRMED' | 'LATE_CANCELLATION';

export interface QualifiedLesson {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  cancelledAt: string | null;
  studentName: string;
  hourlyRate: number;
  amount: number;
  currency: string;
  qualificationReason: QualificationReason;
}

export interface PayoutPreview {
  teacherId: string;
  teacherName: string;
  periodStart: string;
  periodEnd: string;
  qualifiedLessons: QualifiedLesson[];
  totalHours: number;
  totalAmount: number;
  currency: string;
}

export interface TeacherPayoutLesson {
  id: string;
  payoutId: string;
  lessonId: string;
  lessonDate: string;
  durationMinutes: number;
  hourlyRate: number;
  amount: number;
  currency: string;
  qualificationReason: string;
  studentName: string;
  lessonTitle: string;
  createdAt: string;
}

export interface TeacherPayout {
  id: string;
  organizationId: string;
  teacherId: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  totalAmount: number;
  currency: string;
  status: TeacherPayoutStatus;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  teacher?: {
    user: {
      firstName: string;
      lastName: string;
      email?: string;
    };
  };
  lessons?: TeacherPayoutLesson[];
  _count?: {
    lessons: number;
  };
}

export interface TeacherSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hourlyRate: number;
  pendingPayoutsCount: number;
  pendingPayoutsTotal: number;
}

export interface LessonForDay {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  cancelledAt: string | null;
  studentName: string;
  hourlyRate: number;
  amount: number;
  currency: string;
  qualifiesForPayout: boolean;
  qualificationReason: QualificationReason | null;
  payout: {
    id: string;
    status: TeacherPayoutStatus;
    paidAt: string | null;
  } | null;
}

export interface CreatePayoutData {
  teacherId: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

export interface PayoutFilters {
  teacherId?: string;
  status?: TeacherPayoutStatus;
  periodStart?: string;
  periodEnd?: string;
}

const payoutService = {
  // Get teachers summary for overview
  getTeachersSummary: async (): Promise<TeacherSummary[]> => {
    const response = await api.get('/payouts/teachers-summary');
    return response.data;
  },

  // Get all payouts with optional filters
  getPayouts: async (filters?: PayoutFilters): Promise<TeacherPayout[]> => {
    const params = new URLSearchParams();
    if (filters?.teacherId) params.append('teacherId', filters.teacherId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.periodStart) params.append('periodStart', filters.periodStart);
    if (filters?.periodEnd) params.append('periodEnd', filters.periodEnd);

    const response = await api.get(`/payouts?${params.toString()}`);
    return response.data;
  },

  // Get payouts for a specific teacher
  getTeacherPayouts: async (teacherId: string): Promise<TeacherPayout[]> => {
    const response = await api.get(`/payouts/teacher/${teacherId}`);
    return response.data;
  },

  // Preview payout for a teacher
  previewPayout: async (
    teacherId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<PayoutPreview> => {
    const params = new URLSearchParams({
      periodStart,
      periodEnd,
    });
    const response = await api.get(`/payouts/teacher/${teacherId}/preview?${params.toString()}`);
    return response.data;
  },

  // Create payout
  createPayout: async (data: CreatePayoutData): Promise<{ payout: TeacherPayout; preview: PayoutPreview }> => {
    const response = await api.post('/payouts', data);
    return response.data;
  },

  // Get payout by ID
  getPayoutById: async (id: string): Promise<TeacherPayout> => {
    const response = await api.get(`/payouts/${id}`);
    return response.data;
  },

  // Update payout status
  updatePayoutStatus: async (
    id: string,
    status: TeacherPayoutStatus,
    notes?: string
  ): Promise<TeacherPayout> => {
    const response = await api.patch(`/payouts/${id}/status`, { status, notes });
    return response.data;
  },

  // Delete payout
  deletePayout: async (id: string): Promise<void> => {
    await api.delete(`/payouts/${id}`);
  },

  // Get lessons for a specific day (for calendar view)
  getLessonsForDay: async (teacherId: string, date: string): Promise<LessonForDay[]> => {
    const params = new URLSearchParams({ date });
    const response = await api.get(`/payouts/teacher/${teacherId}/lessons?${params.toString()}`);
    return response.data;
  },

  getLessonsForRange: async (
  teacherId: string,
  fromDate: string,
  toDate: string
  ): Promise<LessonForDay[]> => {
    const params = new URLSearchParams({ fromDate, toDate });
    const response = await api.get(`/payouts/teacher/${teacherId}/lessons-range?${params.toString()}`);
    return response.data;
  },
};

export default payoutService;
