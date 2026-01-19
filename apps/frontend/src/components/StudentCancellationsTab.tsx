import { useQuery } from '@tanstack/react-query';
import { lessonService } from '../services/lessonService';
import { Student } from '../services/studentService';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { XCircle, AlertTriangle, CheckCircle, Calendar, DollarSign } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface StudentCancellationsTabProps {
  student: Student;
}

const periodLabels: Record<string, string> = {
  month: 'miesiąc',
  quarter: 'kwartał',
  year: 'rok',
  enrollment: 'od zapisania',
};

export default function StudentCancellationsTab({ student }: StudentCancellationsTabProps) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['cancellation-stats', student.id],
    queryFn: () => lessonService.getCancellationStats(student.id),
  });

  if (isLoading) {
    return <LoadingSpinner message="Ładowanie statystyk odwołań..." />;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
        <p>Błąd ładowania statystyk odwołań</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm', { locale: pl });
    } catch {
      return dateString;
    }
  };

  const formatPeriodStart = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: pl });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Limit Status Card */}
      {stats.limitEnabled ? (
        <div className={`rounded-lg p-6 ${stats.canCancel ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${stats.canCancel ? 'bg-blue-100' : 'bg-red-100'}`}>
                {stats.canCancel ? (
                  <CheckCircle className={`w-8 h-8 ${stats.canCancel ? 'text-blue-600' : 'text-red-600'}`} />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${stats.canCancel ? 'text-blue-800' : 'text-red-800'}`}>
                  {stats.canCancel ? 'Może odwoływać lekcje' : 'Limit odwołań wyczerpany'}
                </h3>
                <p className={`text-sm ${stats.canCancel ? 'text-blue-600' : 'text-red-600'}`}>
                  Wykorzystano {stats.used} z {stats.limit} odwołań ({periodLabels[stats.period || 'month']})
                </p>
                {stats.periodStart && (
                  <p className="text-xs text-gray-500 mt-1">
                    Okres od: {formatPeriodStart(stats.periodStart)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${stats.canCancel ? 'text-blue-600' : 'text-red-600'}`}>
                {stats.remaining !== null ? stats.remaining : '∞'}
              </div>
              <div className={`text-sm ${stats.canCancel ? 'text-blue-600' : 'text-red-600'}`}>
                pozostało
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {stats.limit && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    stats.canCancel ? 'bg-blue-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, (stats.used / stats.limit) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-gray-100">
              <CheckCircle className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Brak limitu odwołań</h3>
              <p className="text-sm text-gray-600">
                Ten uczeń nie ma ustawionego limitu odwołań lekcji.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Lessons List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Historia odwołań ({stats.cancelledLessons.length})
        </h3>

        {stats.cancelledLessons.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Brak odwołanych lekcji w tym okresie</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lekcja
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Planowana data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Odwołana
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Powód
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opłata
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.cancelledLessons.map((lesson) => (
                  <tr key={lesson.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{lesson.title}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{formatDate(lesson.scheduledAt)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{formatDate(lesson.cancelledAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {lesson.cancellationReason || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lesson.cancellationFeeApplied && lesson.cancellationFeeAmount ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          <DollarSign className="w-3 h-3" />
                          {lesson.cancellationFeeAmount.toFixed(2)} PLN
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
