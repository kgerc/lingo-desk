import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reportService, TeacherPayoutData } from '../../services/reportService';
import { Download, FileText, Calendar } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import toast from 'react-hot-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const TeacherPayoutsReport: React.FC = () => {
  const today = new Date();
  const lastMonthStart = startOfMonth(subMonths(today, 1));
  const lastMonthEnd = endOfMonth(subMonths(today, 1));

  const [startDate, setStartDate] = useState(format(lastMonthStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(lastMonthEnd, 'yyyy-MM-dd'));

  // Fetch report data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report-teacher-payouts', startDate, endDate],
    queryFn: () =>
      reportService.getTeacherPayouts({
        startDate,
        endDate,
      }),
  });

  // Export mutations
  const exportCsvMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('teacher-payouts', 'csv', {
        startDate,
        endDate,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `wyplaty-nauczycieli-${startDate}.csv`);
      toast.success('Raport CSV został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu CSV');
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('teacher-payouts', 'pdf', {
        startDate,
        endDate,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `wyplaty-nauczycieli-${startDate}.pdf`);
      toast.success('Raport PDF został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu PDF');
    },
  });

  // Calculate totals
  const totals = data
    ? {
        lessonsCount: data.reduce((sum, row) => sum + row.lessonsCount, 0),
        totalHours: data.reduce((sum, row) => sum + row.totalHours, 0),
        totalPayout: data.reduce((sum, row) => sum + row.totalPayout, 0),
      }
    : { lessonsCount: 0, totalHours: 0, totalPayout: 0 };

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
                      Nauczyciel
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Lekcje
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Godziny
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Wypłata
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row) => (
                    <tr key={row.teacherId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.teacherName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {row.lessonsCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {row.totalHours.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {row.totalPayout.toFixed(2)} PLN
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-900">Liczba nauczycieli</div>
                <div className="mt-1 text-2xl font-bold text-blue-900">{data.length}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-900">Całkowite godziny</div>
                <div className="mt-1 text-2xl font-bold text-green-900">
                  {totals.totalHours.toFixed(2)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-900">Całkowita wypłata</div>
                <div className="mt-1 text-2xl font-bold text-purple-900">
                  {totals.totalPayout.toFixed(2)} PLN
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

export default TeacherPayoutsReport;
