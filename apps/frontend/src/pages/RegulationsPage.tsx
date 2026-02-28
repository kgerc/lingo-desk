import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Save, Info, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import organizationService from '../services/organizationService';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RegulationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canEdit = ['ADMIN', 'MANAGER'].includes(user?.role || '');

  const { data, isLoading } = useQuery({
    queryKey: ['organization-regulations'],
    queryFn: () => organizationService.getRegulations(),
  });

  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (data !== undefined) {
      setContent(data.regulationsContent ?? '');
      setHasChanges(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (regulationsContent: string | null) =>
      organizationService.updateRegulations(regulationsContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-regulations'] });
      toast.success('Regulamin zapisany');
      setHasChanges(false);
    },
    onError: () => toast.error('Błąd podczas zapisywania regulaminu'),
  });

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    setHasChanges(true);
  }

  function handleSave() {
    saveMutation.mutate(content.trim() || null);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  const isEmpty = !content.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Regulamin szkoły</h2>
            {data?.regulationsUpdatedAt && (
              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                Ostatnia aktualizacja: {formatDate(data.regulationsUpdatedAt)}
              </p>
            )}
          </div>
        </div>
        {canEdit && hasChanges && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            Zapisz
          </button>
        )}
      </div>

      {/* Info banner for editors */}
      {canEdit && (
        <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Treść regulaminu jest widoczna dla wszystkich użytkowników organizacji (lektorów, uczniów, metodologów).
            Możesz używać zwykłego tekstu lub podstawowego formatowania.
          </p>
        </div>
      )}

      {/* Content */}
      {canEdit ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">Edytor regulaminu</span>
            {hasChanges && (
              <span className="text-xs text-amber-600 font-medium">Niezapisane zmiany</span>
            )}
          </div>
          <textarea
            value={content}
            onChange={handleContentChange}
            rows={20}
            placeholder="Wpisz treść regulaminu szkoły językowej...&#10;&#10;§1 Postanowienia ogólne&#10;...&#10;&#10;§2 Zasady uczestnictwa&#10;..."
            className="w-full px-4 py-4 text-sm text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-0 border-0"
          />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
              <BookOpen className="w-10 h-10 mb-3 text-gray-200" />
              <p className="text-sm">Regulamin szkoły nie został jeszcze opublikowany.</p>
            </div>
          ) : (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
