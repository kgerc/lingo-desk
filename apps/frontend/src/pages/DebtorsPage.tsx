import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import paymentService from '../services/paymentService';
import { AlertCircle, Mail, Phone, ChevronDown, ChevronUp, Calendar, DollarSign } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const DebtorsPage: React.FC = () => {
  const [expandedDebtors, setExpandedDebtors] = useState<Set<string>>(new Set());

  // Fetch debtors
  const { data: debtors = [], isLoading } = useQuery({
    queryKey: ['debtors'],
    queryFn: () => paymentService.getDebtors(),
  });

  const toggleExpanded = (studentId: string) => {
    setExpandedDebtors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie dłużników..." />;
  }

  const totalDebt = debtors.reduce((sum, debtor) => sum + debtor.totalDebt, 0);
  const totalDebtors = debtors.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-red-600" />
          Dłużnicy
        </h1>
        <p className="mt-2 text-gray-600">Uczniowie z zaległymi płatnościami</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Całkowite zadłużenie</p>
              <p className="text-2xl font-bold text-gray-900">{totalDebt.toFixed(2)} PLN</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Liczba dłużników</p>
              <p className="text-2xl font-bold text-gray-900">{totalDebtors}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Debtors List */}
      {debtors.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Brak dłużników</h3>
          <p className="text-gray-600">Wszyscy uczniowie mają uregulowane płatności!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {debtors.map((debtor) => {
              const isExpanded = expandedDebtors.has(debtor.student.id);

              return (
                <div key={debtor.student.id} className="hover:bg-gray-50 transition-colors">
                  {/* Debtor Header */}
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => toggleExpanded(debtor.student.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          {/* Student Info */}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {debtor.student.user.firstName} {debtor.student.user.lastName}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                {debtor.student.user.email}
                              </div>
                              {debtor.student.user.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-4 w-4" />
                                  {debtor.student.user.phone}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Debt Amount */}
                          <div className="text-right">
                            <div className="text-2xl font-bold text-red-600">
                              {debtor.totalDebt.toFixed(2)} PLN
                            </div>
                            <div className="text-sm text-gray-600">
                              {debtor.paymentsCount} {debtor.paymentsCount === 1 ? 'płatność' : 'płatności'}
                            </div>
                          </div>

                          {/* Days Since Oldest */}
                          <div className="text-center px-4 py-2 bg-orange-100 rounded-lg">
                            <div className="text-lg font-bold text-orange-900">
                              {debtor.daysSinceOldest}
                            </div>
                            <div className="text-xs text-orange-700">dni</div>
                          </div>

                          {/* Expand Icon */}
                          <div>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-gray-200 bg-gray-50">
                      <div className="pt-4">
                        <h4 className="font-semibold text-gray-900 mb-3">Zaległe płatności:</h4>
                        <div className="space-y-2">
                          {debtor.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                            >
                              <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {formatDate(payment.createdAt)}
                                  </div>
                                  {payment.notes && (
                                    <div className="text-xs text-gray-500">{payment.notes}</div>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-red-600">
                                {payment.amount.toFixed(2)} PLN
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtorsPage;
