import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { balanceService, BalanceTransaction } from '../services/balanceService';

interface BalanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName?: string;
}

const formatCurrency = (amount: number, currency: string = 'PLN') => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getTransactionTypeLabel = (type: BalanceTransaction['type']) => {
  const labels: Record<string, string> = {
    DEPOSIT: 'Wpłata',
    LESSON_CHARGE: 'Obciążenie za lekcję',
    LESSON_REFUND: 'Zwrot za lekcję',
    CANCELLATION_FEE: 'Opłata za odwołanie',
    ADJUSTMENT: 'Korekta ręczna',
    REFUND: 'Zwrot środków',
  };
  return labels[type] || type;
};

const getTransactionTypeBadgeColor = (type: BalanceTransaction['type']) => {
  const colors: Record<string, string> = {
    DEPOSIT: 'bg-green-100 text-green-800',
    LESSON_CHARGE: 'bg-blue-100 text-blue-800',
    LESSON_REFUND: 'bg-emerald-100 text-emerald-800',
    CANCELLATION_FEE: 'bg-orange-100 text-orange-800',
    ADJUSTMENT: 'bg-purple-100 text-purple-800',
    REFUND: 'bg-yellow-100 text-yellow-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

const TRANSACTION_TYPES = [
  { value: '', label: 'Wszystkie' },
  { value: 'DEPOSIT', label: 'Wpłaty' },
  { value: 'LESSON_CHARGE', label: 'Obciążenia za lekcje' },
  { value: 'LESSON_REFUND', label: 'Zwroty za lekcje' },
  { value: 'CANCELLATION_FEE', label: 'Opłaty za odwołanie' },
  { value: 'ADJUSTMENT', label: 'Korekty' },
  { value: 'REFUND', label: 'Zwroty' },
];

const PAGE_SIZE = 20;

const BalanceHistoryModal: React.FC<BalanceHistoryModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
}) => {
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['balanceHistory', studentId, page, typeFilter],
    queryFn: () =>
      balanceService.getTransactionHistory(studentId, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        type: typeFilter || undefined,
      }),
    enabled: isOpen && !!studentId,
  });

  if (!isOpen) return null;

  const transactions = data?.transactions || [];
  const totalPages = data ? Math.ceil(data.pagination.total / PAGE_SIZE) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Historia transakcji</h2>
            {studentName && <p className="text-sm text-gray-500">{studentName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Summary */}
        {data && (
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-600">Aktualne saldo: </span>
                <span
                  className={`font-bold ${
                    data.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {formatCurrency(data.currentBalance, data.currency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(0);
                  }}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TRANSACTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              Brak transakcji do wyświetlenia
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opis
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kwota
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo po
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => {
                  const isPositive = ['DEPOSIT', 'LESSON_REFUND'].includes(transaction.type);
                  const adjustmentIsPositive =
                    transaction.type === 'ADJUSTMENT' &&
                    transaction.balanceAfter > transaction.balanceBefore;

                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(transaction.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTransactionTypeBadgeColor(
                            transaction.type
                          )}`}
                        >
                          {isPositive || adjustmentIsPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {getTransactionTypeLabel(transaction.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                        {transaction.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                        <span
                          className={
                            isPositive || adjustmentIsPositive ? 'text-green-600' : 'text-red-600'
                          }
                        >
                          {isPositive || adjustmentIsPositive ? '+' : '-'}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        <span
                          className={
                            transaction.balanceAfter >= 0 ? 'text-gray-700' : 'text-red-600'
                          }
                        >
                          {formatCurrency(transaction.balanceAfter, transaction.currency)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Strona {page + 1} z {totalPages} ({data?.pagination.total} transakcji)
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceHistoryModal;
