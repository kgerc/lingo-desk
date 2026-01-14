import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import substitutionService, { Substitution } from '../services/substitutionService';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { GraduationCap, User, Clock, AlertCircle, Trash2, Calendar } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface SubstitutionsTabProps {
  substitutions: Substitution[];
}

const SubstitutionsTab: React.FC<SubstitutionsTabProps> = ({ substitutions }) => {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => substitutionService.deleteSubstitution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
      toast.success('Zastępstwo zostało usunięte');
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania zastępstwa');
    },
  });

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  };

  if (substitutions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-12">
        <div className="flex flex-col items-center justify-center text-gray-500">
          <GraduationCap className="h-12 w-12 mb-2 text-gray-400" />
          <p className="text-lg font-medium">Brak zastępstw</p>
          <p className="text-sm">Zastępstwa można dodać podczas edycji lekcji</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="grid grid-cols-7 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <div>Lekcja</div>
            <div>Data</div>
            <div>Pierwotny lektor</div>
            <div>Lektor zastępujący</div>
            <div>Uczeń</div>
            <div>Powód</div>
            <div className="text-right">Akcje</div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {substitutions.map((substitution) => (
            <div
              key={substitution.id}
              className="px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="grid grid-cols-7 gap-4 items-center">
                {/* Lesson Title */}
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {substitution.lesson.title}
                  </div>
                  {substitution.lesson.course && (
                    <div className="text-xs text-gray-500">
                      {substitution.lesson.course.name}
                    </div>
                  )}
                </div>

                {/* Date */}
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div className="text-sm text-gray-900">
                    {format(new Date(substitution.lesson.scheduledAt), 'dd MMM yyyy', { locale: pl })}
                    <div className="text-xs text-gray-500">
                      {format(new Date(substitution.lesson.scheduledAt), 'HH:mm', { locale: pl })}
                    </div>
                  </div>
                </div>

                {/* Original Teacher */}
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-gray-400" />
                  <div className="text-sm text-gray-900">
                    {substitution.originalTeacher.user.firstName}{' '}
                    {substitution.originalTeacher.user.lastName}
                  </div>
                </div>

                {/* Substitute Teacher */}
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-amber-500" />
                  <div className="text-sm font-medium text-amber-900">
                    {substitution.substituteTeacher.user.firstName}{' '}
                    {substitution.substituteTeacher.user.lastName}
                  </div>
                </div>

                {/* Student */}
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div className="text-sm text-gray-900">
                    {substitution.lesson.student.user.firstName}{' '}
                    {substitution.lesson.student.user.lastName}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  {substitution.reason ? (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm text-gray-900">{substitution.reason}</div>
                        {substitution.notes && (
                          <div className="text-xs text-gray-500 mt-1">{substitution.notes}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Brak</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end">
                  <button
                    onClick={() => handleDelete(substitution.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Usuń zastępstwo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Usuń zastępstwo"
        message="Czy na pewno chcesz usunąć to zastępstwo? Lekcja pozostanie, ale informacja o zastępstwie zostanie usunięta."
        confirmText="Usuń"
        variant="danger"
      />
    </>
  );
};

export default SubstitutionsTab;
