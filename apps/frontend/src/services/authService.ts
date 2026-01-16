import api from '../lib/api';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
}

export const authService = {
  async login(credentials: LoginCredentials) {
    const response = await api.post('/auth/login', credentials) as any;
    return response.data.data;
  },

  async register(data: RegisterData) {
    const response = await api.post('/auth/register', data) as any;
    return response.data.data;
  },

  async getMe() {
    const response = await api.get('/auth/me') as any;
    return response.data.data;
  },
};
