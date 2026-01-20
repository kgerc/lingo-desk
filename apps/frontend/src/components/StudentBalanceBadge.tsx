import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { balanceService } from '../services/balanceService';

interface StudentBalanceBadgeProps {
  studentId: string;
}

const formatCurrency = (amount: number, currency: string = 'PLN') => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const StudentBalanceBadge: React.FC<StudentBalanceBadgeProps> = ({ studentId }) => {
  const { data: balance, isLoading } = useQuery({
    queryKey: ['studentBalance', studentId],
    queryFn: () => balanceService.getStudentBalance(studentId),
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <span className="inline-block w-16 h-5 bg-gray-200 rounded animate-pulse" />
    );
  }

  if (!balance) {
    return (
      <span className="text-xs text-gray-400">—</span>
    );
  }

  const isPositive = balance.balance > 0;
  const isNegative = balance.balance < 0;

  return (
    <span
      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
        isNegative
          ? 'bg-red-100 text-red-800'
          : isPositive
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-600'
      }`}
      title={isNegative ? 'Zaległość' : isPositive ? 'Nadpłata' : 'Saldo zerowe'}
    >
      {formatCurrency(balance.balance, balance.currency)}
    </span>
  );
};

export default StudentBalanceBadge;
