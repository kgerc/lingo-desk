import React, { useState } from 'react';
import { displayEmail } from '../utils/email';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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
  const [paymentMode, setPaymentMode] = useState<'PACKAGE' | 'PER_LESSON'>('PACKAGE');
  const [hoursPurchased, setHoursPurchased] = useState<number>(0);
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
    mutationFn: (data: { studentId: string; paymentMode: 'PACKAGE' | 'PER_LESSON'; hoursPurchased: number }) =>
      courseService.enrollStudent(course.id, data.studentId, data.paymentMode, data.hoursPurchased),
    onSuccess: () => {
      toast.success('Uczeń został pomyślnie zapisany na kurs');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', course.id] });
      setSelectedStudentId('');
      setPaymentMode('PACKAGE');
      setHoursPurchased(0);
      setError('');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas zapisywania ucznia';
      toast.error(errorMessage);
      setError(errorMessage);
    },
  });

  // Unenroll mutation
  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId: string) => courseService.unenrollStudent(enrollmentId),
    onSuccess: () => {
      toast.success('Uczeń został pomyślnie wypisany z kursu');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['course', course.id] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.error?.message || 'Wystąpił błąd podczas wypisywania ucznia';
      toast.error(errorMessage);
      setError(errorMessage);
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

    // Validate hours for PACKAGE mode
    if (paymentMode === 'PACKAGE' && hoursPurchased <= 0) {
      setError('Dla trybu pakietowego należy podać liczbę zakupionych godzin');
      return;
    }

    await enrollMutation.mutateAsync({ studentId: selectedStudentId, paymentMode, hoursPurchased });
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

            {/* Student selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wybierz ucznia</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={isFull || availableStudents.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100"
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
                    {student.user.firstName} {student.user.lastName}{displayEmail(student.user.email) ? ` - ${displayEmail(student.user.email)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment mode selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tryb płatności</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as 'PACKAGE' | 'PER_LESSON')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="PACKAGE">Pakiet godzin (uczeń kupuje godziny z góry)</option>
                <option value="PER_LESSON">Płatność za lekcję (każda lekcja wymaga osobnej płatności)</option>
              </select>
            </div>

            {/* Hours purchased - only for PACKAGE mode */}
            {paymentMode === 'PACKAGE' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Liczba zakupionych godzin
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={hoursPurchased}
                  onChange={(e) => setHoursPurchased(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="np. 10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Liczba godzin, które uczeń zakupił w ramach pakietu
                </p>
              </div>
            )}

            {/* Info box about payment mode */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
              {paymentMode === 'PACKAGE' ? (
                <>
                  <p className="font-medium text-gray-900 mb-1">Tryb pakietowy:</p>
                  <p className="text-gray-600">
                    Przy oznaczaniu lekcji jako zakończonej system sprawdzi, czy uczeń ma wystarczającą liczbę godzin.
                    Godziny będą automatycznie odliczane z pakietu.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900 mb-1">Płatność za lekcję:</p>
                  <p className="text-gray-600">
                    Przy oznaczaniu lekcji jako zakończonej system utworzy oczekującą płatność za tę lekcję.
                    Uczeń będzie widoczny w zakładce "Dłużnicy" do czasu opłacenia.
                  </p>
                </>
              )}
            </div>

            {/* Submit button */}
            <button
              onClick={handleEnroll}
              disabled={!selectedStudentId || enrollMutation.isPending || isFull}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <UserPlus className="h-5 w-5" />
              {enrollMutation.isPending ? 'Zapisywanie...' : 'Zapisz ucznia na kurs'}
            </button>
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
                {enrolledStudents.map((student) => {
                  const enrollment = currentCourse.enrollments?.find((e) => e.studentId === student.id);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                          {student.user.firstName[0]}
                          {student.user.lastName[0]}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {student.user.firstName} {student.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{displayEmail(student.user.email) ?? <span className="italic text-gray-400">Brak adresu email</span>}</p>
                          {enrollment && (
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span
                                className={`px-2 py-0.5 rounded ${
                                  enrollment.paymentMode === 'PACKAGE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {enrollment.paymentMode === 'PACKAGE' ? 'Pakiet' : 'Za lekcję'}
                              </span>
                              {enrollment.paymentMode === 'PACKAGE' && (
                                <span className="text-gray-600">
                                  {enrollment.hoursUsed}/{enrollment.hoursPurchased} godz.
                                </span>
                              )}
                            </div>
                          )}
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
                  );
                })}
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
