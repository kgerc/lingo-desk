import api from '../lib/api';

export interface DashboardSettings {
  enabledMetrics: string[];
  enabledCharts: string[];
}

export interface OrganizationSettingsData {
  dashboard?: DashboardSettings;
  [key: string]: any;
}

export interface OrganizationSettings {
  id: string;
  organizationId: string;
  lessonReminderHours: number;
  budgetAlertThresholdHours: number;
  autoGenerateLessonsEnabled: boolean;
  settings?: OrganizationSettingsData;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  timezone: string;
  currency: string;
  country: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  description?: string;
  settings?: OrganizationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface UserOrganization {
  id: string;
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'STUDENT' | 'PARENT';
  isActive: boolean;
  isPrimary: boolean;
  organization: Organization;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationData {
  name?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  timezone?: string;
  currency?: string;
  country?: string;
}

export interface CreateOrganizationData extends UpdateOrganizationData {
  name: string;
  slug: string;
}

export interface VisibilitySettings {
  teacher: {
    hourlyRate: boolean;
    contractType: boolean;
    email: boolean;
    phone: boolean;
    notes: boolean;
    payouts: boolean;
  };
  student: {
    email: boolean;
    phone: boolean;
    address: boolean;
    notes: boolean;
    payments: boolean;
    budget: boolean;
  };
}

const organizationService = {
  async getOrganization(): Promise<Organization> {
    const response = await api.get('/organizations') as any;
    return response.data.data;
  },

  async getUserOrganizations(): Promise<UserOrganization[]> {
    const response = await api.get('/organizations/my-organizations') as any;
    return response.data.data;
  },

  async updateOrganization(data: UpdateOrganizationData): Promise<Organization> {
    const response = await api.put('/organizations', data) as any;
    return response.data.data;
  },

  async createOrganization(data: CreateOrganizationData): Promise<Organization> {
    const response = await api.post('/organizations', data) as any;
    return response.data.data;
  },

  async switchOrganization(organizationId: string): Promise<UserOrganization> {
    const response = await api.post('/organizations/switch', { organizationId }) as any;
    return response.data.data;
  },

  async updateOrganizationSettings(data: Partial<OrganizationSettings>): Promise<OrganizationSettings> {
    const response = await api.put('/organizations/settings', data) as any;
    return response.data.data;
  },

  async getVisibilitySettings(): Promise<VisibilitySettings> {
    const response = await api.get('/organizations/visibility') as any;
    return response.data.data;
  },

  async updateVisibilitySettings(data: VisibilitySettings): Promise<OrganizationSettings> {
    const response = await api.put('/organizations/visibility', data) as any;
    return response.data.data;
  },

  async getSkipHolidays(): Promise<{ skipHolidays: boolean }> {
    const response = await api.get('/organizations/holidays/settings') as any;
    return response.data.data;
  },

  async updateSkipHolidays(skipHolidays: boolean): Promise<OrganizationSettings> {
    const response = await api.put('/organizations/holidays/settings', { skipHolidays }) as any;
    return response.data.data;
  },

  async getHolidays(year?: number): Promise<{ date: string; name: string }[]> {
    const params = year ? `?year=${year}` : '';
    const response = await api.get(`/organizations/holidays${params}`) as any;
    return response.data.data;
  },

  async checkHoliday(date: string): Promise<{ isHoliday: boolean; holidayName: string | null }> {
    const response = await api.get(`/organizations/holidays/check?date=${date}`) as any;
    return response.data.data;
  },
};

export default organizationService;
