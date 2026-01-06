import api from '../lib/api';

export interface TeacherScheduleFilters {
  startDate?: string;
  endDate?: string;
}

export interface AvailabilityException {
  id: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  createdAt: string;
}

export interface TeacherPreferences {
  id: string;
  teacherId: string;
  timezone: string;
  prepTimeMinutes: number;
  maxLessonsPerDay?: number;
  minBreakBetweenMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAvailabilityException {
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface UpdateTeacherPreferences {
  timezone?: string;
  prepTimeMinutes?: number;
  maxLessonsPerDay?: number;
  minBreakBetweenMinutes?: number;
}

const teacherScheduleService = {
  // Get logged-in teacher's schedule
  getMySchedule: (filters?: TeacherScheduleFilters) =>
    api.get('/teachers/me/schedule', { params: filters }).then((res) => res.data.data),

  // Get availability exceptions for a teacher
  getAvailabilityExceptions: (teacherId: string, filters?: TeacherScheduleFilters) =>
    api
      .get(`/teachers/${teacherId}/availability/exceptions`, { params: filters })
      .then((res) => res.data.data),

  // Add availability exception (blackout date)
  addAvailabilityException: (teacherId: string, exception: CreateAvailabilityException) =>
    api
      .post(`/teachers/${teacherId}/availability/exceptions`, exception)
      .then((res) => res.data.data),

  // Delete availability exception
  deleteAvailabilityException: (teacherId: string, exceptionId: string) =>
    api
      .delete(`/teachers/${teacherId}/availability/exceptions/${exceptionId}`)
      .then((res) => res.data),

  // Get teacher preferences
  getPreferences: (teacherId: string) =>
    api.get(`/teachers/${teacherId}/preferences`).then((res) => res.data.data),

  // Update teacher preferences
  updatePreferences: (teacherId: string, preferences: UpdateTeacherPreferences) =>
    api.put(`/teachers/${teacherId}/preferences`, preferences).then((res) => res.data.data),
};

export default teacherScheduleService;
