import api from '../lib/api';

interface ReportFilters {
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  courseId?: string;
  month?: number;
  year?: number;
  periodDays?: number;
  minAmount?: number;
  daysPastDue?: number;
}

interface TeacherPayoutData {
  teacherId: string;
  teacherName: string;
  email: string;
  contractType: string;
  hourlyRate: number;
  lessonsCount: number;
  totalHours: number;
  totalPayout: number;
  payoutStatus?: string;
}

interface NewStudentData {
  studentId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  enrollmentDate: string;
  languageLevel: string | null;
  goals: string | null;
  enrollmentsCount: number;
  totalSpent: number;
}

interface MarginData {
  courseId: string;
  courseName: string;
  language: string;
  level: string;
  courseType: string;
  paymentsCount: number;
  totalRevenue: number;
  lessonsCount: number;
  totalTeacherCost: number;
  grossProfit: number;
  marginPercent: number;
}

interface DebtorData {
  studentId: string;
  studentName: string;
  email: string;
  phone: string | null;
  totalDebt: number;
  oldestPaymentDate: string;
  daysOverdue: number;
  pendingPaymentsCount: number;
}

interface RetentionData {
  totalStudents: number;
  activeStudents: number;
  churnedStudents: number;
  atRiskStudents: number;
  retentionRate: number;
  churnRate: number;
  activeStudentsList: Array<{
    studentId: string;
    studentName: string;
    lastLessonDate: string;
    totalLessons: number;
  }>;
  churnedStudentsList: Array<{
    studentId: string;
    studentName: string;
    lastLessonDate: string | null;
    daysSinceLastLesson: number | null;
    totalLessons: number;
  }>;
  atRiskStudentsList: Array<{
    studentId: string;
    studentName: string;
    lastLessonDate: string;
    daysSinceLastLesson: number;
    totalLessons: number;
  }>;
}

class ReportService {
  /**
   * Get teacher payouts report
   */
  async getTeacherPayouts(filters: ReportFilters): Promise<TeacherPayoutData[]> {
    const response = await api.get('/reports/teacher-payouts', { params: filters }) as any;
    return response.data.data;
  }

  /**
   * Get new students report
   */
  async getNewStudents(month: number, year: number): Promise<NewStudentData[]> {
    const response = await api.get('/reports/new-students', {
      params: { month, year },
    }) as any;
    return response.data.data;
  }

  /**
   * Get margins report
   */
  async getMargins(filters: ReportFilters): Promise<MarginData[]> {
    const response = await api.get('/reports/margins', { params: filters }) as any;
    return response.data.data;
  }

  /**
   * Get debtors report
   */
  async getDebtors(filters?: { minAmount?: number; daysPastDue?: number }): Promise<DebtorData[]> {
    const response = await api.get('/reports/debtors', { params: filters }) as any;
    return response.data.data;
  }

  /**
   * Get retention report
   */
  async getRetention(periodDays: number = 30): Promise<RetentionData> {
    const response = await api.get('/reports/retention', {
      params: { periodDays },
    }) as any;
    return response.data.data;
  }

  /**
   * Export report
   */
  async exportReport(
    reportType: string,
    format: 'csv' | 'pdf',
    filters: ReportFilters
  ): Promise<Blob> {
    const response = await api.get(`/reports/export/${reportType}`, {
      params: { ...filters, format },
      responseType: 'blob',
    }) as any;
    return response.data;
  }

  /**
   * Download file helper
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const reportService = new ReportService();
export type {
  TeacherPayoutData,
  NewStudentData,
  MarginData,
  DebtorData,
  RetentionData,
  ReportFilters,
};
