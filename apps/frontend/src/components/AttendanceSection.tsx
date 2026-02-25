import React, { useState } from 'react';
import { displayEmail } from '../utils/email';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import attendanceService, { AttendanceStatus } from '../services/attendanceService';
import { Lesson } from '../services/lessonService';
import { Users, Save, Check, X, Clock, AlertCircle } from 'lucide-react';

interface AttendanceSectionProps {
  lesson: Lesson;
}

const AttendanceSection: React.FC<AttendanceSectionProps> = ({ lesson }) => {
  const queryClient = useQueryClient();
  const [attendanceData, setAttendanceData] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch attendance for this lesson
  const { data: attendances = [], isLoading } = useQuery({
    queryKey: ['attendances', lesson.id],
    queryFn: () => attendanceService.getAttendanceByLesson(lesson.id),
  });

  // Initialize attendance data when loaded
  React.useEffect(() => {
    if (attendances.length > 0) {
      const initialData: Record<string, { status: AttendanceStatus; notes: string }> = {};
      attendances.forEach((att) => {
        initialData[att.studentId] = {
          status: att.status,
          notes: att.notes || '',
        };
      });
      setAttendanceData(initialData);
    }
  }, [attendances]);

  // Bulk update mutation
  const bulkUpsertMutation = useMutation({
    mutationFn: () => {
      const attendancesArray = Object.entries(attendanceData).map(([studentId, data]) => ({
        studentId,
        status: data.status,
        notes: data.notes || undefined,
      }));

      return attendanceService.bulkUpsertAttendance({
        lessonId: lesson.id,
        attendances: attendancesArray,
      });
    },
    onSuccess: () => {
      toast.success('Lista obecności została zapisana');
      queryClient.invalidateQueries({ queryKey: ['attendances', lesson.id] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas zapisywania obecności';
      toast.error(errorMessage);
    },
  });

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: {
        status,
        notes: prev[studentId]?.notes || '',
      },
    }));
    setHasChanges(true);
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'PRESENT',
        notes,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    bulkUpsertMutation.mutate();
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    const badges = {
      PRESENT: { label: 'Obecny', icon: Check, className: 'bg-green-100 text-green-800 border-green-200' },
      ABSENT: { label: 'Nieobecny', icon: X, className: 'bg-red-100 text-red-800 border-red-200' },
      LATE: { label: 'Spóźniony', icon: Clock, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      EXCUSED: { label: 'Usprawiedliwiony', icon: AlertCircle, className: 'bg-blue-100 text-blue-800 border-blue-200' },
    };
    return badges[status];
  };

  const getStatusColor = (status: AttendanceStatus) => {
    const colors = {
      PRESENT: 'border-green-500 bg-green-50',
      ABSENT: 'border-red-500 bg-red-50',
      LATE: 'border-yellow-500 bg-yellow-50',
      EXCUSED: 'border-blue-500 bg-blue-50',
    };
    return colors[status];
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lista obecności
        </h3>
        <div className="text-sm text-gray-500">Ładowanie...</div>
      </div>
    );
  }

  // For single student lesson
  const studentId = lesson.studentId;
  const currentStatus = attendanceData[studentId]?.status || 'PRESENT';
  const currentNotes = attendanceData[studentId]?.notes || '';
  const badge = getStatusBadge(currentStatus);
  const StatusIcon = badge.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lista obecności
        </h3>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={bulkUpsertMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {bulkUpsertMutation.isPending ? 'Zapisywanie...' : 'Zapisz obecność'}
          </button>
        )}
      </div>

      <div className={`border-2 rounded-lg p-4 ${getStatusColor(currentStatus)}`}>
        <div className="space-y-4">
          {/* Student Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {lesson.student.user.avatarUrl ? (
                <img
                  src={lesson.student.user.avatarUrl}
                  alt={`${lesson.student.user.firstName} ${lesson.student.user.lastName}`}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium">
                  {lesson.student.user.firstName[0]}
                  {lesson.student.user.lastName[0]}
                </div>
              )}
              <div>
                <p className="font-medium text-gray-900">
                  {lesson.student.user.firstName} {lesson.student.user.lastName}
                </p>
                <p className="text-sm text-gray-600">{displayEmail(lesson.student.user.email) ?? <span className="italic text-gray-400">Brak adresu email</span>}</p>
              </div>
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${badge.className}`}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{badge.label}</span>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status obecności</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as AttendanceStatus[]).map((status) => {
                const statusBadge = getStatusBadge(status);
                const Icon = statusBadge.icon;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(studentId, status)}
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                      currentStatus === status
                        ? `${statusBadge.className} border-opacity-100 font-medium`
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{statusBadge.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notatki (opcjonalnie)
            </label>
            <textarea
              value={currentNotes}
              onChange={(e) => handleNotesChange(studentId, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Dodatkowe informacje o obecności..."
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-3">
        <p className="font-medium text-gray-700">Informacja:</p>
        <p className="mt-1">
          Lista obecności pozwala śledzić obecność uczniów na lekcjach. Wybierz odpowiedni status i dodaj notatki jeśli potrzebne.
        </p>
      </div>
    </div>
  );
};

export default AttendanceSection;
