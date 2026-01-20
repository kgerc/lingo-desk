import api from '../lib/api';

export interface BalanceTransaction {
  id: string;
  type: 'DEPOSIT' | 'LESSON_CHARGE' | 'LESSON_REFUND' | 'CANCELLATION_FEE' | 'ADJUSTMENT' | 'REFUND';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  description: string;
  lessonId?: string;
  paymentId?: string;
  createdBy?: string;
  metadata?: any;
  createdAt: string;
}

export interface StudentBalance {
  balance: number;
  currency: string;
  lastUpdatedAt: string;
  recentTransactions: BalanceTransaction[];
}

export interface TransactionHistoryResponse {
  transactions: BalanceTransaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  currentBalance: number;
  currency: string;
}

export interface TransactionFilters {
  limit?: number;
  offset?: number;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const balanceService = {
  // Get student balance (admin/manager)
  getStudentBalance: async (studentId: string): Promise<StudentBalance> => {
    const response = await api.get(`/balance/${studentId}`);
    return response.data;
  },

  // Get transaction history (admin/manager)
  getTransactionHistory: async (
    studentId: string,
    filters?: TransactionFilters
  ): Promise<TransactionHistoryResponse> => {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);

    const response = await api.get(`/balance/${studentId}/transactions?${params.toString()}`);
    return response.data;
  },

  // Adjust balance (admin/manager)
  adjustBalance: async (
    studentId: string,
    amount: number,
    description: string
  ): Promise<{ success: boolean; previousBalance: number; newBalance: number; transactionId: string }> => {
    const response = await api.post(`/balance/${studentId}/adjust`, { amount, description });
    return response.data;
  },

  // Get current user's balance (student portal)
  getMyBalance: async (): Promise<StudentBalance> => {
    const response = await api.get('/balance/my');
    return response.data;
  },

  // Get current user's transaction history (student portal)
  getMyTransactionHistory: async (filters?: TransactionFilters): Promise<TransactionHistoryResponse> => {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);

    const response = await api.get(`/balance/my/transactions?${params.toString()}`);
    return response.data;
  },
};

export default balanceService;
