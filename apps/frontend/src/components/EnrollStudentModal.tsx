import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { courseService, Course } from '../services/courseService';
import { studentService } from '../services/studentService';
import { X, UserPlus, UserMinus } from 'lucide-react';

interface EnrollStudentModalProps {
  course: Course;
  onClose: () => void;
}

const EnrollStudentModal: React.FC<EnrollStudentModalProps> = ({ course, onClose }) => {
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError] = useState('');

  // Fetch all active students
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents({ isActive: true }),
  });

  // Fetch current course data to get updated enrollments
  const { data: currentCourse } = useQuery({
    queryKey: ['course', course.id],
    queryFn: () => courseService.getCourseById(course.id),
    initialData: course,
  });

  // Get enrolled student IDs
  const enrolledStudentIds = new Set(currentCourse.enrollments?.map((e) => e.studentId) || []);

  // Filter available students (not enrolled yet)
  const availableStudents = allStudents.filter((student) => !enrolledStudentIds.has(student.id));

  // Get enrolled students
  const enrolledStudents = allStudents.filter((student) => enrolledStudentIds.has(student.id));

  // Enroll mutation
  const enrollMutation = useMutation({
    mutationFn: (studentId: string) => courseService.enrollStudent(course.id, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      setSelectedStudentId('');
      setError('');
    },
    onError: (error: any) => {
      setError(error.response?.data?.error?.message || 'Wystąpił błąd podczas zapisywania ucznia');
    },
  });

  // Unenroll mutation
  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId: string) => courseService.unenrollStudent(enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', course.id] });
    },
    onError: (error: any) => {
      setError(error.response?.data?.error?.message || 'Wystąpił błąd podczas wypisywania ucznia');
    },
  });

  const handleEnroll = async () => {
    if (!selectedStudentId) {
      setError('Wybierz ucznia z listy');
      return;
    }

    // Check if course is full
    if (currentCourse.maxStudents && enrolledStudents.length >= currentCourse.maxStudents) {
      setError(`Kurs osiągnął maksymalną liczbę uczestników (${currentCourse.maxStudents})`);
      return;
    }

    await enrollMutation.mutateAsync(selectedStudentId);
  };

  const handleUnenroll = async (studentId: string) => {
    const enrollment = currentCourse.enrollments?.find((e) => e.studentId === studentId);
    if (!enrollment) return;

    if (window.confirm('Czy na pewno chcesz wypisać tego ucznia z kursu?')) {
      await unenrollMutation.mutateAsync(enrollment.id);
    }
  };

  const isFull = currentCourse.maxStudents ? enrolledStudents.length >= currentCourse.maxStudents : false;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Zarządzaj uczniami</h2>
            <p className="text-sm text-gray-500 mt-1">{course.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Course capacity info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">Zapisanych uczniów</p>
                <p className="text-2xl font-bold text-blue-600">
                  {enrolledStudents.length}
                  {course.maxStudents ? ` / ${course.maxStudents}` : ''}
                </p>
              </div>
              {isFull && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  Kurs pełny
                </span>
              )}
            </div>
          </div>

          {/* Add student */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Dodaj ucznia</h3>
            <div className="flex gap-2">
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={isFull || availableStudents.length === 0}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
              >
                <option value="">
                  {isFull
                    ? 'Kurs pełny'
                    : availableStudents.length === 0
                    ? 'Brak dostępnych uczniów'
                    : 'Wybierz ucznia'}
                </option>
                {availableStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.user.firstName} {student.user.lastName} - {student.user.email}
                  </option>
                ))}
              </select>
              <button
                onClick={handleEnroll}
                disabled={!selectedStudentId || enrollMutation.isPending || isFull}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <UserPlus className="h-5 w-5" />
                Zapisz
              </button>
            </div>
          </div>

          {/* Enrolled students list */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Zapisani uczniowie ({enrolledStudents.length})
            </h3>

            {enrolledStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Brak zapisanych uczniów</p>
                <p className="text-sm mt-1">Dodaj pierwszego ucznia do kursu</p>
              </div>
            ) : (
              <div className="space-y-2">
                {enrolledStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                        {student.user.firstName[0]}
                        {student.user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {student.user.firstName} {student.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{student.user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnenroll(student.id)}
                      disabled={unenrollMutation.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Wypisz z kursu"
                    >
                      <UserMinus className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnrollStudentModal;
