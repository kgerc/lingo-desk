import api from '../lib/api';

export interface DashboardStats {
  students: {
    total: number;
    active: number;
  };
  teachers: {
    total: number;
    active: number;
  };
  courses: {
    total: number;
    active: number;
  };
  lessonsToday: number;
  revenue: {
    total: number;
    last30Days: Array<{
      date: string;
      amount: number;
    }>;
  };
  lessonsLast30Days: Array<{
    date: string;
    count: number;
  }>;
}

export interface TeacherReminder {
  id: string;
  studentName: string;
  teacherName: string;
  courseName: string;
  scheduledAt: string;
  message: string;
  type: string;
}

export interface TeacherReminders {
  incompleteAttendance: TeacherReminder[];
}

class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get('/dashboard/stats');
    return response.data.data;
  }

  async getReminders(): Promise<TeacherReminders> {
    const response = await api.get('/dashboard/reminders');
    return response.data.data;
  }
}

export const dashboardService = new DashboardService();
