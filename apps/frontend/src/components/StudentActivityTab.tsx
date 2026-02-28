import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LogIn, Clock } from 'lucide-react';
import { studentService, StudentActivityEntry } from '../services/studentService';
import LoadingSpinner from './LoadingSpinner';

interface Props {
  studentId: string;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  LOGIN: <LogIn className="w-4 h-4 text-blue-500" />,
};

const TYPE_COLOR: Record<string, string> = {
  LOGIN: 'bg-blue-50 border-blue-100',
};

export default function StudentActivityTab({ studentId }: Props) {
  const { data: activity, isLoading } = useQuery({
    queryKey: ['student-activity', studentId],
    queryFn: () => studentService.getStudentActivity(studentId, 20),
    enabled: !!studentId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const isEmpty = !activity || activity.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Historia aktywności</h3>
        {!isEmpty && (
          <span className="text-xs text-gray-400">Ostatnie {activity.length} zdarzeń</span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
          <Clock className="w-10 h-10 mb-3 text-gray-200" />
          <p className="text-sm font-medium">Brak historii aktywności</p>
          <p className="text-xs mt-1">Uczeń jeszcze się nie logował.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activity.map((entry: StudentActivityEntry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-2.5 border rounded-lg ${TYPE_COLOR[entry.type] ?? 'bg-gray-50 border-gray-100'}`}
            >
              <div className="flex-shrink-0">
                {TYPE_ICON[entry.type] ?? <Clock className="w-4 h-4 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-800">{entry.label}</span>
              </div>
              <div className="flex-shrink-0 text-xs text-gray-500">
                {formatDateTime(entry.date)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
