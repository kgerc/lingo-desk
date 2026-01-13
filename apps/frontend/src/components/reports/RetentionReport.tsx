import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { reportService } from '../../services/reportService';
import { Download, FileText, TrendingUp, TrendingDown, AlertTriangle, Users } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const RetentionReport: React.FC = () => {
  const [periodDays, setPeriodDays] = useState(30);

  // Fetch report data
  const { data, isLoading } = useQuery({
    queryKey: ['report-retention', periodDays],
    queryFn: () => reportService.getRetention(periodDays),
  });

  // Export mutations
  const exportCsvMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('retention', 'csv', {
        periodDays,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `retencja-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('Raport CSV został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu CSV');
    },
  });

  const exportPdfMutation = useMutation({
    mutationFn: () =>
      reportService.exportReport('retention', 'pdf', {
        periodDays,
      }),
    onSuccess: (blob) => {
      reportService.downloadFile(blob, `retencja-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Raport PDF został pobrany');
    },
    onError: () => {
      toast.error('Błąd podczas eksportu PDF');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header with Filters and Export */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Period Filter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Okres aktywności:</label>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            >
              <option value={30}>30 dni</option>
              <option value={60}>60 dni</option>
              <option value={90}>90 dni</option>
            </select>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsvMutation.mutate()}
              disabled={exportCsvMutation.isPending || !data}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              onClick={() => exportPdfMutation.mutate()}
              disabled={exportPdfMutation.isPending || !data}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : data ? (
        <>
          {/* Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Wszyscy uczniowie</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{data.totalStudents}</p>
                </div>
                <Users className="h-12 w-12 text-gray-400" />
              </div>
            </div>

            <div className="bg-green-50 rounded-lg shadow-sm border border-green-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-900">Aktywni</p>
                  <p className="mt-2 text-3xl font-bold text-green-900">{data.activeStudents}</p>
                  <p className="mt-1 text-sm text-green-700">{data.retentionRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-12 w-12 text-green-600" />
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg shadow-sm border border-yellow-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-900">Zagrożeni</p>
                  <p className="mt-2 text-3xl font-bold text-yellow-900">{data.atRiskStudents}</p>
                  <p className="mt-1 text-sm text-yellow-700">30-60 dni bez lekcji</p>
                </div>
                <AlertTriangle className="h-12 w-12 text-yellow-600" />
              </div>
            </div>

            <div className="bg-red-50 rounded-lg shadow-sm border border-red-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-900">Odeszli</p>
                  <p className="mt-2 text-3xl font-bold text-red-900">{data.churnedStudents}</p>
                  <p className="mt-1 text-sm text-red-700">{data.churnRate.toFixed(1)}%</p>
                </div>
                <TrendingDown className="h-12 w-12 text-red-600" />
              </div>
            </div>
          </div>

          {/* Active Students List */}
          {data.activeStudentsList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Aktywni uczniowie ({data.activeStudentsList.length})
                </h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Ostatnia lekcja
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Liczba lekcji
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.activeStudentsList.slice(0, 10).map((student) => (
                        <tr key={student.studentId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{student.studentName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {format(new Date(student.lastLessonDate), 'dd.MM.yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {student.totalLessons}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.activeStudentsList.length > 10 && (
                  <p className="mt-4 text-sm text-gray-500 text-center">
                    Pokazano 10 z {data.activeStudentsList.length} aktywnych uczniów
                  </p>
                )}
              </div>
            </div>
          )}

          {/* At Risk Students List */}
          {data.atRiskStudentsList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Uczniowie zagrożeni ({data.atRiskStudentsList.length})
                </h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Ostatnia lekcja
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Dni bez lekcji
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Liczba lekcji
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.atRiskStudentsList.map((student) => (
                        <tr key={student.studentId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{student.studentName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {format(new Date(student.lastLessonDate), 'dd.MM.yyyy')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {student.daysSinceLastLesson} dni
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {student.totalLessons}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Churned Students List */}
          {data.churnedStudentsList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Uczniowie którzy odeszli ({data.churnedStudentsList.length})
                </h3>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Student
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Ostatnia lekcja
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Dni bez lekcji
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Liczba lekcji
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {data.churnedStudentsList.slice(0, 10).map((student) => (
                        <tr key={student.studentId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{student.studentName}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {student.lastLessonDate
                              ? format(new Date(student.lastLessonDate), 'dd.MM.yyyy')
                              : 'Brak lekcji'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {student.daysSinceLastLesson ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {student.daysSinceLastLesson} dni
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">
                            {student.totalLessons}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.churnedStudentsList.length > 10 && (
                  <p className="mt-4 text-sm text-gray-500 text-center">
                    Pokazano 10 z {data.churnedStudentsList.length} uczniów
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default RetentionReport;
