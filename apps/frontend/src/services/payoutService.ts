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
  payoutPercent: number; // 100 = full payout, e.g. 80 = 80% of rate
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
  payoutPercent: number | null; // null = 100%, otherwise partial % (e.g. 80)
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
  payoutPercent: number | null; // null or 100 = full payout, e.g. 80 = 80% of rate
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

// Grouped payout data by student
export interface StudentPayoutGroup {
  studentName: string;
  lessonsCount: number;
  totalMinutes: number;
  totalHours: number;
  totalAmount: number;
  currency: string;
  lessons: QualifiedLesson[];
}

// Utility function to group lessons by student
export function groupLessonsByStudent(lessons: QualifiedLesson[]): StudentPayoutGroup[] {
  const groupMap = new Map<string, StudentPayoutGroup>();

  for (const lesson of lessons) {
    const existing = groupMap.get(lesson.studentName);

    if (existing) {
      existing.lessons.push(lesson);
      existing.lessonsCount++;
      existing.totalMinutes += lesson.durationMinutes;
      existing.totalHours = existing.totalMinutes / 60;
      existing.totalAmount += lesson.amount;
    } else {
      groupMap.set(lesson.studentName, {
        studentName: lesson.studentName,
        lessonsCount: 1,
        totalMinutes: lesson.durationMinutes,
        totalHours: lesson.durationMinutes / 60,
        totalAmount: lesson.amount,
        currency: lesson.currency,
        lessons: [lesson],
      });
    }
  }

  // Sort by student name
  return Array.from(groupMap.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName, 'pl')
  );
}

// Grouped lessons for day view (LessonForDay type)
export interface StudentLessonsGroup {
  studentName: string;
  lessonsCount: number;
  totalMinutes: number;
  totalHours: number;
  totalAmount: number;
  currency: string;
  lessons: LessonForDay[];
}

// Utility function to group LessonForDay by student
export function groupLessonsForDayByStudent(lessons: LessonForDay[]): StudentLessonsGroup[] {
  const groupMap = new Map<string, StudentLessonsGroup>();

  for (const lesson of lessons) {
    const existing = groupMap.get(lesson.studentName);

    if (existing) {
      existing.lessons.push(lesson);
      existing.lessonsCount++;
      existing.totalMinutes += lesson.durationMinutes;
      existing.totalHours = existing.totalMinutes / 60;
      existing.totalAmount += lesson.amount;
    } else {
      groupMap.set(lesson.studentName, {
        studentName: lesson.studentName,
        lessonsCount: 1,
        totalMinutes: lesson.durationMinutes,
        totalHours: lesson.durationMinutes / 60,
        totalAmount: lesson.amount,
        currency: lesson.currency,
        lessons: [lesson],
      });
    }
  }

  // Sort by student name
  return Array.from(groupMap.values()).sort((a, b) =>
    a.studentName.localeCompare(b.studentName, 'pl')
  );
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
