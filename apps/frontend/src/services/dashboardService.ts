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
  debtors: {
    count: number;
    totalAmount: number;
  };
  pendingPayments: {
    count: number;
    totalAmount: number;
  };
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

export type DateRangeType = 'last30days' | 'month' | 'year';

export interface ChartDataParams {
  rangeType: DateRangeType;
  year?: number;
  month?: number;
}

export interface ChartDataPoint {
  date: string;
  label: string;
  amount?: number;
  count?: number;
}

export interface ChartData {
  rangeType: DateRangeType;
  startDate: string;
  endDate: string;
  groupBy: 'day' | 'month';
  revenue: {
    data: ChartDataPoint[];
    total: number;
  };
  lessons: {
    data: ChartDataPoint[];
    total: number;
  };
}

class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get('/dashboard/stats') as any;
    return response.data.data;
  }

  async getChartData(params: ChartDataParams): Promise<ChartData> {
    const queryParams = new URLSearchParams();
    queryParams.append('rangeType', params.rangeType);
    if (params.year) queryParams.append('year', params.year.toString());
    if (params.month) queryParams.append('month', params.month.toString());

    const response = await api.get(`/dashboard/charts?${queryParams.toString()}`) as any;
    return response.data.data;
  }

  async getReminders(): Promise<TeacherReminders> {
    const response = await api.get('/dashboard/reminders') as any;
    return response.data.data;
  }
}

export const dashboardService = new DashboardService();
