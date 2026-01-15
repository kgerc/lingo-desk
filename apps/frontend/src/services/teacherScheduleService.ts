import api from '../lib/api';

export interface TeacherScheduleFilters {
  startDate?: string;
  endDate?: string;
}

const teacherScheduleService = {
  // Get logged-in teacher's schedule
  getMySchedule: (filters?: TeacherScheduleFilters) =>
    api.get('/teachers/me/schedule', { params: filters }).then((res) => res.data.data),
};

export default teacherScheduleService;
