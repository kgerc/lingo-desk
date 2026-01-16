import api from '../lib/api';

export interface TeacherScheduleFilters {
  startDate?: string;
  endDate?: string;
}

const teacherScheduleService = {
  getMySchedule: (filters?: TeacherScheduleFilters) =>
    // Zakładamy, że odpowiedź to obiekt z polem data, które zawiera tablicę lekcji
    api.get<{ data: any }>(
      '/teachers/me/schedule', 
      { params: filters }
    ).then((res) => res.data.data), 
};

export default teacherScheduleService;
