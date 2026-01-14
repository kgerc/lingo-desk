import api from '../lib/api';

export interface Teacher {
  id: string;
  userId: string;
  hourlyRate: number;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface Lesson {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  student: {
    id: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  };
  course?: {
    id: string;
    name: string;
  };
}

export interface Substitution {
  id: string;
  organizationId: string;
  lessonId: string;
  originalTeacherId: string;
  substituteTeacherId: string;
  reason?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lesson: Lesson;
  originalTeacher: Teacher;
  substituteTeacher: Teacher;
}

export interface CreateSubstitutionData {
  lessonId: string;
  originalTeacherId: string;
  substituteTeacherId: string;
  reason?: string;
  notes?: string;
}

export interface UpdateSubstitutionData {
  substituteTeacherId?: string;
  reason?: string;
  notes?: string;
}

export interface GetSubstitutionsParams {
  originalTeacherId?: string;
  substituteTeacherId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

class SubstitutionService {
  /**
   * Get all substitutions
   */
  async getSubstitutions(params?: GetSubstitutionsParams): Promise<Substitution[]> {
    const response = await api.get('/substitutions', { params });
    return response.data.data;
  }

  /**
   * Get substitution by ID
   */
  async getSubstitutionById(id: string): Promise<Substitution> {
    const response = await api.get(`/substitutions/${id}`);
    return response.data.data;
  }

  /**
   * Get substitution by lesson ID
   */
  async getSubstitutionByLessonId(lessonId: string): Promise<Substitution | null> {
    try {
      const response = await api.get(`/substitutions/lesson/${lessonId}`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new substitution
   */
  async createSubstitution(data: CreateSubstitutionData): Promise<Substitution> {
    const response = await api.post('/substitutions', data);
    return response.data.data;
  }

  /**
   * Update substitution
   */
  async updateSubstitution(id: string, data: UpdateSubstitutionData): Promise<Substitution> {
    const response = await api.put(`/substitutions/${id}`, data);
    return response.data.data;
  }

  /**
   * Delete substitution
   */
  async deleteSubstitution(id: string): Promise<void> {
    await api.delete(`/substitutions/${id}`);
  }
}

const substitutionService = new SubstitutionService();
export default substitutionService;
