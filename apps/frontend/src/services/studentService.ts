import api from '../lib/api';

export interface Student {
  id: string;
  userId: string;
  studentNumber: string;
  languageLevel: string;
  goals?: string;
  isMinor: boolean;
  paymentDueDays?: number | null;
  enrollmentDate: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    isActive: boolean;
    createdAt: string;
    profile?: {
      dateOfBirth?: string;
      address?: string;
    };
  };
  budget?: {
    totalHoursPurchased: number;
    totalHoursUsed: number;
    balance: number;
  };
  enrollments?: any[];
}

export interface CreateStudentData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  languageLevel: string;
  goals?: string;
  isMinor?: boolean;
  paymentDueDays?: number | null;
}

export interface UpdateStudentData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  address?: string;
  languageLevel?: string;
  goals?: string;
  isMinor?: boolean;
  paymentDueDays?: number | null;
  isActive?: boolean;
}

export const studentService = {
  async getStudents(filters?: { search?: string; languageLevel?: string; isActive?: boolean }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.languageLevel) params.append('languageLevel', filters.languageLevel);
    if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));

    const response = await api.get(`/students?${params.toString()}`);
    return response.data.data as Student[];
  },

  async getStudentById(id: string) {
    const response = await api.get(`/students/${id}`);
    return response.data.data as Student;
  },

  async createStudent(data: CreateStudentData) {
    const response = await api.post('/students', data);
    return response.data.data as Student;
  },

  async updateStudent(id: string, data: UpdateStudentData) {
    const response = await api.put(`/students/${id}`, data);
    return response.data.data as Student;
  },

  async deleteStudent(id: string) {
    const response = await api.delete(`/students/${id}`);
    return response.data;
  },

  async getStats() {
    const response = await api.get('/students/stats');
    return response.data.data as { total: number; active: number; lowBudget: number };
  },

  async getEnrollmentBudget(enrollmentId: string) {
    const response = await api.get(`/students/enrollment/${enrollmentId}/budget`);
    return response.data.data as {
      enrollmentId: string;
      studentName: string;
      courseName: string;
      hoursPurchased: number;
      hoursUsed: number;
      hoursRemaining: number;
      lowBudget: boolean;
      status: string;
      enrollmentDate: string;
      expiresAt?: string;
    };
  },

  async getStudentsWithLowBudget() {
    // Get all students with their enrollments
    const students = await this.getStudents({ isActive: true });

    // For each student, check their enrollments for low budget
    const lowBudgetAlerts: Array<{
      studentId: string;
      studentName: string;
      enrollmentId: string;
      courseName: string;
      hoursRemaining: number;
    }> = [];

    for (const student of students) {
      if (student.enrollments) {
        for (const enrollment: any of student.enrollments) {
          const hoursPurchased = parseFloat(enrollment.hoursPurchased?.toString() || '0');
          const hoursUsed = parseFloat(enrollment.hoursUsed?.toString() || '0');
          const hoursRemaining = hoursPurchased - hoursUsed;

          if (hoursRemaining <= 2 && hoursRemaining > 0 && enrollment.status === 'ACTIVE') {
            lowBudgetAlerts.push({
              studentId: student.id,
              studentName: `${student.user.firstName} ${student.user.lastName}`,
              enrollmentId: enrollment.id,
              courseName: enrollment.course?.name || 'N/A',
              hoursRemaining,
            });
          }
        }
      }
    }

    return lowBudgetAlerts;
  },
};
