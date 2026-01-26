import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reportService } from '../../services/reportService';
import { Download, FileText, Calendar } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import toast from 'react-hot-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const MarginsReport: React.FC = () => {
  const today = new Date();
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));

  const [startDate, setStartDate] = useState(format(lastMonthStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(lastMonthEnd, 'yyyy-MM-dd'));

  // Fetch report data
  const { data, isLoading } = useQuery({
    queryKey: ['report-margins', startDate, endDate],
    queryFn: () =>
      reportService.getMargins({
        startDate,
        endDate,
      }),
  });

  // Export mutations
  const exportCsvMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('margins', 'csv', {
        startDate,
        endDate,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `marze-${startDate}.csv`);
      toast.success('Raport CSV został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu CSV');
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('margins', 'pdf', {
        startDate,
        endDate,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `marze-${startDate}.pdf`);
      toast.success('Raport PDF został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu PDF');
    },
  });

  // Calculate totals
  const totals = data
    ? {
        totalRevenue: data.reduce((sum, row) => sum + row.totalRevenue, 0),
        totalCosts: data.reduce((sum, row) => sum + row.totalTeacherCost, 0),
        totalProfit: data.reduce((sum, row) => sum + row.grossProfit, 0),
      }
    : { totalRevenue: 0, totalCosts: 0, totalProfit: 0 };

  const avgMargin = totals.totalRevenue > 0 ? (totals.totalProfit / totals.totalRevenue) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Filters and Export Buttons */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Date Range Filter */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              />
              <span className="text-gray-500">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              />
            </div>
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
                      Typ kursu
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Format
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Przychód
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Koszty
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Zysk
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Marża
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row) => (
                    <tr key={row.courseId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {row.courseName}
                        <div className="text-xs text-gray-500">
                          {row.language} {row.level}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.courseType === 'GROUP' ? 'Grupowy' : 'Indywidualny'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {row.totalRevenue.toFixed(2)} PLN
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {row.totalTeacherCost.toFixed(2)} PLN
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {row.grossProfit.toFixed(2)} PLN
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            row.marginPercent >= 30
                              ? 'bg-green-100 text-green-800'
                              : row.marginPercent >= 15
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {row.marginPercent.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-900">Całkowity przychód</div>
                <div className="mt-1 text-2xl font-bold text-blue-900">
                  {totals.totalRevenue.toFixed(2)} PLN
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm font-medium text-red-900">Całkowite koszty</div>
                <div className="mt-1 text-2xl font-bold text-red-900">
                  {totals.totalCosts.toFixed(2)} PLN
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-900">Całkowity zysk</div>
                <div className="mt-1 text-2xl font-bold text-green-900">
                  {totals.totalProfit.toFixed(2)} PLN
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-900">Średnia marża</div>
                <div className="mt-1 text-2xl font-bold text-purple-900">
                  {avgMargin.toFixed(1)}%
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Brak danych dla wybranego okresu</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarginsReport;
