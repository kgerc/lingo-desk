import api from '../lib/api';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface Attendance {
  id: string;
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    userId: string;
    studentNumber: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatarUrl?: string;
    };
  };
}

export interface CreateAttendanceData {
  lessonId: string;
  studentId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface UpdateAttendanceData {
  status?: AttendanceStatus;
  notes?: string;
}

export interface BulkUpsertAttendanceData {
  lessonId: string;
  attendances: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
}

class AttendanceService {
  async getAttendanceByLesson(lessonId: string): Promise<Attendance[]> {
    const response = await api.get(`/attendance/lesson/${lessonId}`) as any;
    return response.data.data;
  }

  async createAttendance(data: CreateAttendanceData): Promise<Attendance> {
    const response = await api.post('/attendance', data) as any;
    return response.data.data;
  }

  async updateAttendance(
    lessonId: string,
    studentId: string,
    data: UpdateAttendanceData
  ): Promise<Attendance> {
    const response = await api.put(`/attendance/${lessonId}/${studentId}`, data) as any;
    return response.data.data;
  }

  async deleteAttendance(lessonId: string, studentId: string): Promise<void> {
    await api.delete(`/attendance/${lessonId}/${studentId}`);
  }

  async bulkUpsertAttendance(data: BulkUpsertAttendanceData): Promise<Attendance[]> {
    const response = await api.post('/attendance/bulk-upsert', data) as any;
    return response.data.data;
  }
}

export default new AttendanceService();
