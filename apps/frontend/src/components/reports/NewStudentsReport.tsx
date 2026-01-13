import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reportService } from '../../services/reportService';
import { Download, FileText } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const NewStudentsReport: React.FC = () => {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // Fetch report data
  const { data, isLoading } = useQuery({
    queryKey: ['report-new-students', selectedMonth, selectedYear],
    queryFn: () => reportService.getNewStudents(selectedMonth, selectedYear),
  });

  // Export mutations
  const exportCsvMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('new-students', 'csv', {
        month: selectedMonth,
        year: selectedYear,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `nowi-uczniowie-${selectedMonth}-${selectedYear}.csv`);
      toast.success('Raport CSV został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu CSV');
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('new-students', 'pdf', {
        month: selectedMonth,
        year: selectedYear,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `nowi-uczniowie-${selectedMonth}-${selectedYear}.pdf`);
      toast.success('Raport PDF został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu PDF');
    },
  });

  // Calculate totals
  const totalSpent = data ? data.reduce((sum, row) => sum + row.totalSpent, 0) : 0;

  const months = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];

  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Filters and Export Buttons */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Month/Year Filter */}
          <div className="flex items-center gap-4">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            >
              {months.map((month, index) => (
                <option key={index} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
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
                      Imię i nazwisko
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Data zapisu
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Poziom
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Wydano
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row) => (
                    <tr key={row.studentId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {row.firstName} {row.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{row.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {format(new Date(row.enrollmentDate), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {row.languageLevel || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                        {row.totalSpent.toFixed(2)} PLN
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-900">Liczba nowych uczniów</div>
                <div className="mt-1 text-2xl font-bold text-blue-900">{data.length}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-900">Łączne wydatki</div>
                <div className="mt-1 text-2xl font-bold text-green-900">
                  {totalSpent.toFixed(2)} PLN
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Brak nowych uczniów w wybranym miesiącu</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewStudentsReport;
