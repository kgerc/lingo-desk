import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reportService } from '../../services/reportService';
import { Download, FileText } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const DebtorsReport: React.FC = () => {
  // Fetch report data
  const { data, isLoading } = useQuery({
    queryKey: ['report-debtors'],
    queryFn: () => reportService.getDebtors(),
  });

  // Export mutations
  const exportCsvMutation = useMutation({
    mutationFn: () => reportService.exportReport('debtors', 'csv', {}),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `dluznicy-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Raport CSV został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu CSV');
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: () => reportService.exportReport('debtors', 'pdf', {}),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `dluznicy-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Raport PDF został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu PDF');
    },
  });

  // Calculate total debt
  const totalDebt = data ? data.reduce((sum, row) => sum + row.totalDebt, 0) : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Export Buttons */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lista dłużników</h2>
            <p className="text-sm text-gray-500 mt-1">
              Uczniowie z zaległymi płatnościami
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsvMutation.mutate()}
              disabled={exportCsvMutation.isPending || !data || data.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => exportPdfMutation.mutate()}
              disabled={exportPdfMutation.isPending || !data || data.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : data && data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Dług
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Najstarsza płatność
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Dni opóźnienia
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Płatności
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row) => (
                    <tr key={row.studentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.studentName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.email}</td>
                      <td className="px-4 py-3 text-sm font-medium text-red-600 text-right">
                        {row.totalDebt.toFixed(2)} PLN
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {format(new Date(row.oldestPaymentDate), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            row.daysOverdue > 30
                              ? 'bg-red-100 text-red-800'
                              : row.daysOverdue > 7
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {row.daysOverdue} dni
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {row.pendingPaymentsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm font-medium text-red-900">Liczba dłużników</div>
                <div className="mt-1 text-2xl font-bold text-red-900">{data.length}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-sm font-medium text-orange-900">Łączny dług</div>
                <div className="mt-1 text-2xl font-bold text-orange-900">
                  {totalDebt.toFixed(2)} PLN
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Brak dłużników - wszyscy uczniowie mają uregulowane płatności</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtorsReport;
