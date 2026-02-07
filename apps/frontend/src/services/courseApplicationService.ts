import axios from 'axios';
import { api } from '../lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Public API instance (no auth token)
const publicApi = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export interface CourseApplication {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string | null;
  courseId: string | null;
  preferences: string | null;
  languageLevel: string | null;
  availability: string | null;
  notes: string | null;
  status: 'NEW' | 'ACCEPTED' | 'REJECTED';
  internalNotes: string | null;
  convertedStudentId: string | null;
  createdAt: string;
  updatedAt: string;
  course?: {
    id: string;
    name: string;
    language: string;
    level: string;
    courseType: string;
  } | null;
}

export interface PublicCourse {
  id: string;
  name: string;
  language: string;
  level: string;
  courseType: string;
}

export interface PublicOrgInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface SubmitApplicationData {
  name: string;
  email: string;
  phone?: string;
  courseId?: string;
  preferences?: string;
  languageLevel?: string;
  availability?: string;
  notes?: string;
}

export interface ConvertToStudentData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  languageLevel?: string;
  language?: string;
}

const courseApplicationService = {
  // === PUBLIC METHODS (no auth) ===

  async getPublicCourses(orgSlug: string): Promise<{ organization: PublicOrgInfo; courses: PublicCourse[] }> {
    const response = await publicApi.get(`/applications/public/${orgSlug}/courses`);
    return response.data.data;
  },

  async submitApplication(orgSlug: string, data: SubmitApplicationData): Promise<CourseApplication> {
    const response = await publicApi.post(`/applications/public/${orgSlug}`, data);
    return response.data.data;
  },

  // === PROTECTED METHODS (require auth) ===

  async getApplications(filters?: { status?: string; search?: string }): Promise<CourseApplication[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    const response = await api.get(`/applications?${params.toString()}`) as any;
    return response.data.data;
  },

  async getApplicationById(id: string): Promise<CourseApplication> {
    const response = await api.get(`/applications/${id}`) as any;
    return response.data.data;
  },

  async updateStatus(id: string, status: string, internalNotes?: string): Promise<CourseApplication> {
    const response = await api.put(`/applications/${id}/status`, { status, internalNotes }) as any;
    return response.data.data;
  },

  async convertToStudent(id: string, data: ConvertToStudentData): Promise<{ student: any; application: CourseApplication }> {
    const response = await api.post(`/applications/${id}/convert`, data) as any;
    return response.data.data;
  },
};

export default courseApplicationService;
