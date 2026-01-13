import api from '../lib/api';

export interface Payment {
  id: string;
  organizationId: string;
  studentId: string;
  enrollmentId?: string;
  lessonId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  stripePaymentIntentId?: string;
  paidAt?: string;
  notes?: string;
  exchangeRateOverride?: number;
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
  lesson?: {
    id: string;
    title: string;
    scheduledAt: string;
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
  exchangeRateOverride?: number;
}

export interface UpdatePaymentData {
  amount?: number;
  currency?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  notes?: string;
  paidAt?: string;
  exchangeRateOverride?: number;
}

export interface GetPaymentsFilters {
  studentId?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'ONLINE' | 'OTHER';
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  currency?: string;
  convertToCurrency?: string;
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

  /**
   * Import payments from CSV
   */
  async importPayments(csvData: string): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string; data: string }>;
  }> {
    const response = await api.post('/payments/import', { csvData });
    return response.data.data;
  },

  /**
   * Get debtors - students with pending payments
   */
  async getDebtors(): Promise<Array<{
    student: {
      id: string;
      userId: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
      };
    };
    totalDebt: number;
    paymentsCount: number;
    oldestPaymentDate: string;
    daysSinceOldest: number;
    payments: Array<{
      id: string;
      amount: number;
      createdAt: string;
      dueAt?: string | null;
      notes?: string;
    }>;
  }>> {
    const response = await api.get('/payments/debtors');
    return response.data.data;
  },
};

export default paymentService;
