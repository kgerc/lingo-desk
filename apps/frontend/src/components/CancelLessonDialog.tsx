import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { lessonService, Lesson } from '../services/lessonService';
import { AlertTriangle, X, DollarSign, Clock, Ban } from 'lucide-react';

interface CancelLessonDialogProps {
  lesson: Lesson;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelLessonDialog({
  lesson,
  isOpen,
  onClose,
  onSuccess,
}: CancelLessonDialogProps) {
  const queryClient = useQueryClient();
  const [cancellationReason, setCancellationReason] = useState('');

  // Fetch cancellation fee preview
  const { data: feePreview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['cancellation-fee-preview', lesson.id],
    queryFn: () => lessonService.getCancellationFeePreview(lesson.id),
    enabled: isOpen,
  });

  // Fetch cancellation stats (limit check)
  const { data: cancellationStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['cancellation-stats', lesson.studentId],
    queryFn: () => lessonService.getCancellationStats(lesson.studentId),
    enabled: isOpen,
  });

  // Cancel lesson mutation
  const cancelMutation = useMutation({
    mutationFn: () =>
      lessonService.updateLesson(lesson.id, {
        status: 'CANCELLED',
        cancellationReason: cancellationReason || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      if (feePreview?.feeApplies) {
        toast.success(`Lekcja anulowana. Naliczono opłatę ${feePreview.feeAmount?.toFixed(2)} ${feePreview.currency}`);
      } else {
        toast.success('Lekcja została anulowana');
      }
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd podczas anulowania lekcji');
    },
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setCancellationReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Anuluj lekcję</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Lesson Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900">{lesson.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(lesson.scheduledAt).toLocaleDateString('pl-PL', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {lesson.pricePerLesson && (
                <p className="text-sm text-gray-500 mt-1">
                  Cena lekcji: {formatCurrency(lesson.pricePerLesson, lesson.currency || 'PLN')}
                </p>
              )}
            </div>

            {/* Cancellation Limit Info */}
            {isLoadingStats ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                Sprawdzanie limitu odwołań...
              </div>
            ) : cancellationStats?.limitEnabled && !cancellationStats?.canCancel ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Ban className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Limit odwołań wyczerpany</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Uczeń wykorzystał już wszystkie dozwolone odwołania w tym okresie
                      ({cancellationStats.used} z {cancellationStats.limit}).
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      Nie można anulować tej lekcji. Skontaktuj się z administratorem.
                    </p>
                  </div>
                </div>
              </div>
            ) : cancellationStats?.limitEnabled ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Limit odwołań</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Wykorzystano {cancellationStats.used} z {cancellationStats.limit} odwołań.
                      Pozostało: {cancellationStats.remaining}.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Cancellation Fee Info */}
            {isLoadingPreview ? (
              <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                Sprawdzanie opłaty za anulowanie...
              </div>
            ) : feePreview?.feeApplies ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Opłata za późne anulowanie</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Anulowanie tej lekcji spowoduje naliczenie opłaty w wysokości{' '}
                      <span className="font-bold">
                        {formatCurrency(feePreview.feeAmount!, feePreview.currency)}
                      </span>{' '}
                      ({feePreview.feePercent}% ceny lekcji).
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        Do lekcji pozostało {feePreview.hoursUntilLesson.toFixed(1)} godzin
                        (próg: {feePreview.hoursThreshold}h)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : feePreview?.hoursThreshold ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-800">Anulowanie bez opłaty</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Anulowanie w odpowiednim czasie - brak dodatkowych opłat.
                      Do lekcji pozostało {feePreview.hoursUntilLesson.toFixed(1)} godzin.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Cancellation Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Powód anulowania (opcjonalnie)
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Podaj powód anulowania lekcji..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Zamknij
            </button>
            <button
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || (cancellationStats?.limitEnabled && !cancellationStats?.canCancel)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelMutation.isPending ? 'Anulowanie...' : 'Anuluj lekcję'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
