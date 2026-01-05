import api from '../lib/api';

export interface Payment {
  id: string;
  organizationId: string;
  studentId: string;
  enrollmentId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  stripePaymentIntentId?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    userId: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  enrollment?: {
    id: string;
    course: {
      name: string;
    };
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
  };
}

export interface CreatePaymentData {
  studentId: string;
  enrollmentId?: string;
  amount: number;
  currency?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  notes?: string;
  paidAt?: string;
}

export interface UpdatePaymentData {
  amount?: number;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  notes?: string;
  paidAt?: string;
}

export interface GetPaymentsFilters {
  studentId?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface PaymentStats {
  totalRevenue: number;
  pendingRevenue: number;
  completedPayments: number;
  pendingPayments: number;
}

const paymentService = {
  /**
   * Get all payments with filters
   */
  async getPayments(filters?: GetPaymentsFilters): Promise<Payment[]> {
    const response = await api.get('/payments', { params: filters });
    return response.data.data;
  },

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<Payment> {
    const response = await api.get(`/payments/${id}`);
    return response.data.data;
  },

  /**
   * Create new payment
   */
  async createPayment(data: CreatePaymentData): Promise<Payment> {
    const response = await api.post('/payments', data);
    return response.data.data;
  },

  /**
   * Update payment
   */
  async updatePayment(id: string, data: UpdatePaymentData): Promise<Payment> {
    const response = await api.put(`/payments/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete payment
   */
  async deletePayment(id: string): Promise<void> {
    await api.delete(`/payments/${id}`);
  },

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<PaymentStats> {
    const response = await api.get('/payments/stats');
    return response.data.data;
  },

  /**
   * Get student payment history
   */
  async getStudentPaymentHistory(studentId: string): Promise<Payment[]> {
    const response = await api.get(`/payments/student/${studentId}`);
    return response.data.data;
  },
};

export default paymentService;
