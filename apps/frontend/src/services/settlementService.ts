import api from '../lib/api';

export interface StudentWithBalance {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  currentBalance: number;
  lastSettlementDate: string | null;
  pendingPaymentsCount: number;
  pendingPaymentsSum: number;
}

export interface PaymentBreakdownItem {
  id: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  status: string;
}

export interface DepositBreakdownItem {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  date: string;
}

export interface SettlementPreview {
  studentId: string;
  studentName: string;
  periodStart: string;
  periodEnd: string;
  totalPaymentsDue: number;
  paymentsBreakdown: PaymentBreakdownItem[];
  totalPaymentsReceived: number;
  depositsBreakdown: DepositBreakdownItem[];
  balanceBefore: number;
  periodBalance: number;
  balanceAfter: number;
  currency: string;
}

export interface Settlement {
  id: string;
  organizationId: string;
  studentId: string;
  budgetId: string;
  periodStart: string;
  periodEnd: string;
  totalPaymentsDue: number;
  totalPaymentsReceived: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  student?: {
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

export interface StudentSettlementInfo {
  lastSettlementDate: string | null;
  currentBalance: number;
}

export interface CreateSettlementData {
  studentId: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

const settlementService = {
  // Get all students with their balance info
  getStudentsWithBalance: async (): Promise<StudentWithBalance[]> => {
    const response = await api.get('/settlements/students');
    return response.data;
  },

  // Get settlement info for a specific student
  getStudentSettlementInfo: async (studentId: string): Promise<StudentSettlementInfo> => {
    const response = await api.get(`/settlements/student/${studentId}/info`);
    return response.data;
  },

  // Get all settlements for a student
  getStudentSettlements: async (studentId: string): Promise<Settlement[]> => {
    const response = await api.get(`/settlements/student/${studentId}`);
    return response.data;
  },

  // Preview settlement (calculate without saving)
  previewSettlement: async (
    studentId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<SettlementPreview> => {
    const response = await api.post('/settlements/preview', {
      studentId,
      periodStart,
      periodEnd,
    });
    return response.data;
  },

  // Create and save settlement
  createSettlement: async (data: CreateSettlementData): Promise<{ settlement: Settlement; preview: SettlementPreview }> => {
    const response = await api.post('/settlements', data);
    return response.data;
  },

  // Get settlement by ID
  getSettlementById: async (id: string): Promise<Settlement> => {
    const response = await api.get(`/settlements/${id}`);
    return response.data;
  },

  // Delete settlement (only most recent)
  deleteSettlement: async (id: string): Promise<void> => {
    await api.delete(`/settlements/${id}`);
  },
};

export default settlementService;
