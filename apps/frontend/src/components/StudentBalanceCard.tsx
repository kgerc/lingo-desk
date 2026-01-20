import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, TrendingDown, History, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import { balanceService, BalanceTransaction } from '../services/balanceService';
import BalanceHistoryModal from './BalanceHistoryModal';

interface StudentBalanceCardProps {
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
    LESSON_CHARGE: 'Lekcja',
    LESSON_REFUND: 'Zwrot za lekcję',
    CANCELLATION_FEE: 'Opłata za odwołanie',
    ADJUSTMENT: 'Korekta',
    REFUND: 'Zwrot',
  };
  return labels[type] || type;
};

const getTransactionIcon = (type: BalanceTransaction['type']) => {
  const isPositive = ['DEPOSIT', 'LESSON_REFUND'].includes(type);
  return isPositive ? (
    <TrendingUp className="w-4 h-4 text-green-500" />
  ) : (
    <TrendingDown className="w-4 h-4 text-red-500" />
  );
};

const StudentBalanceCard: React.FC<StudentBalanceCardProps> = ({ studentId, studentName }) => {
  const queryClient = useQueryClient();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');

  const { data: balance, isLoading, error } = useQuery({
    queryKey: ['studentBalance', studentId],
    queryFn: () => balanceService.getStudentBalance(studentId),
    enabled: !!studentId,
  });

  const adjustMutation = useMutation({
    mutationFn: ({ amount, description }: { amount: number; description: string }) =>
      balanceService.adjustBalance(studentId, amount, description),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['studentBalance', studentId] });
      toast.success(`Saldo zaktualizowane: ${formatCurrency(result.newBalance)}`);
      setIsAdjustOpen(false);
      setAdjustAmount('');
      setAdjustDescription('');
    },
    onError: () => {
      toast.error('Nie udało się zaktualizować salda');
    },
  });

  const handleAdjust = () => {
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Podaj prawidłową kwotę');
      return;
    }
    if (!adjustDescription.trim()) {
      toast.error('Podaj opis korekty');
      return;
    }

    const finalAmount = adjustType === 'add' ? amount : -amount;
    adjustMutation.mutate({ amount: finalAmount, description: adjustDescription });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error || !balance) {
    return null;
  }

  const isPositive = balance.balance >= 0;

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Saldo konta</h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsAdjustOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Korekta
            </button>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <History className="w-4 h-4" />
              Historia
            </button>
          </div>
        </div>

        <div className="mb-4">
          <div className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(balance.balance, balance.currency)}
          </div>
          {!isPositive && (
            <p className="text-sm text-red-500 mt-1">
              Uczeń ma zaległość do opłacenia
            </p>
          )}
          {isPositive && balance.balance > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Nadpłata - środki na koncie
            </p>
          )}
        </div>

        {balance.recentTransactions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Ostatnie transakcje</h4>
            <div className="space-y-2">
              {balance.recentTransactions.slice(0, 5).map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(transaction.type)}
                    <div>
                      <span className="font-medium">{getTransactionTypeLabel(transaction.type)}</span>
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">
                        {transaction.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-medium ${
                        ['DEPOSIT', 'LESSON_REFUND'].includes(transaction.type)
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {['DEPOSIT', 'LESSON_REFUND'].includes(transaction.type) ? '+' : '-'}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </span>
                    <p className="text-xs text-gray-400">{formatDate(transaction.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {isAdjustOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Korekta salda</h3>

            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('add')}
                  className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center gap-2 ${
                    adjustType === 'add'
                      ? 'bg-green-50 border-green-500 text-green-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Dodaj
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('subtract')}
                  className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center gap-2 ${
                    adjustType === 'subtract'
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  Odejmij
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kwota (PLN)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opis korekty</label>
                <input
                  type="text"
                  value={adjustDescription}
                  onChange={(e) => setAdjustDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="np. Korekta za błędnie naliczoną lekcję"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsAdjustOpen(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleAdjust}
                disabled={adjustMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {adjustMutation.isPending ? 'Zapisywanie...' : 'Zapisz korektę'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      <BalanceHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        studentId={studentId}
        studentName={studentName}
      />
    </>
  );
};

export default StudentBalanceCard;
