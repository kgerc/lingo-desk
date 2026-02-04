import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentService, Student } from '../services/studentService';
import { Plus, Search, Mail, Phone, MoreVertical, Upload, X, Calculator } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import StudentModal from '../components/StudentModal';
import ImportStudentsModal from '../components/ImportStudentsModal';
import StudentCancellationsTab from '../components/StudentCancellationsTab';
import StudentBalanceBadge from '../components/StudentBalanceBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Dropdown from '../components/Dropdown';

const StudentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCancellationsModalOpen, setIsCancellationsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; studentId: string | null }>({ isOpen: false, studentId: null });
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Check if user has access to settlements (ADMIN, MANAGER, HR)
  const canAccessSettlements = ['ADMIN', 'MANAGER', 'HR'].includes(user?.role || '');

  // Navigate to settlements for a specific student
  const handleGoToSettlements = (student: Student) => {
    navigate(`/payments?tab=settlements&studentId=${student.id}`);
  };

  // Fetch students
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', searchTerm],
    queryFn: () => studentService.getStudents({ search: searchTerm }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentService.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Uczeń został pomyślnie usunięty');
    },
    onError: () => {
      toast.error('Nie udało się usunąć ucznia');
    },
  });

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleShowCancellations = (student: Student) => {
    setSelectedStudent(student);
    setIsCancellationsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, studentId: id });
  };

  const confirmDelete = async () => {
    if (confirmDialog.studentId) {
      await deleteMutation.mutateAsync(confirmDialog.studentId);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStudent(null);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    handleCloseModal();
  };

  const getLanguageLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      A1: 'bg-green-100 text-green-800',
      A2: 'bg-green-200 text-green-900',
      B1: 'bg-blue-100 text-blue-800',
      B2: 'bg-blue-200 text-blue-900',
      C1: 'bg-purple-100 text-purple-800',
      C2: 'bg-purple-200 text-purple-900',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[level] || 'bg-gray-100 text-gray-800'}`}>
        {level}
      </span>
    );
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Uczniowie</h1>
          <p className="mt-2 text-gray-600">
            Zarządzaj uczniami swojej szkoły ({students.length} uczniów)
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-secondary text-secondary rounded-lg hover:bg-secondary hover:text-white transition-colors shadow-sm"
          >
            <Upload className="h-5 w-5" />
            Import CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Dodaj ucznia
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj ucznia po imieniu, nazwisku lub emailu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        {isLoading ? (
          <LoadingSpinner message="Ładowanie uczniów..." />
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {searchTerm ? 'Nie znaleziono uczniów' : 'Brak uczniów. Dodaj pierwszego ucznia!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nr
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uczeń
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kontakt
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Poziom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  {canAccessSettlements && (
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rozliczenie
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      #{student.studentNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                            {student.user.firstName[0]}
                            {student.user.lastName[0]}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {student.user.firstName} {student.user.lastName}
                          </div>
                          {student.isMinor && (
                            <span className="text-xs text-orange-600">Niepełnoletni</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {student.user.email}
                        </div>
                        {student.user.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {student.user.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getLanguageLevelBadge(student.languageLevel)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          student.user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {student.user.isActive ? 'Aktywny' : 'Nieaktywny'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StudentBalanceBadge studentId={student.id} />
                    </td>
                    {canAccessSettlements && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleGoToSettlements(student)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
                          title="Przejdź do rozliczeń ucznia"
                        >
                          <Calculator className="h-4 w-4" />
                          Rozlicz
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        ref={(el) => {
                          if (el) {
                            dropdownTriggerRefs.current.set(student.id, el);
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === student.id ? null : student.id);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Akcje"
                      >
                        <MoreVertical className="h-4 w-4 text-gray-600" />
                      </button>
                      <Dropdown
                        isOpen={openDropdownId === student.id}
                        onClose={() => setOpenDropdownId(null)}
                        triggerRef={{ current: dropdownTriggerRefs.current.get(student.id) || null }}
                        items={[
                          {
                            label: 'Edytuj ucznia',
                            onClick: () => handleEdit(student),
                          },
                          {
                            label: 'Odwołania',
                            onClick: () => handleShowCancellations(student),
                          },
                          {
                            label: 'Usuń ucznia',
                            onClick: () => handleDelete(student.id),
                            variant: 'danger',
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <StudentModal
          student={selectedStudent}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <ImportStudentsModal
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['students'] });
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, studentId: null })}
        onConfirm={confirmDelete}
        title="Usuń ucznia"
        message="Czy na pewno chcesz usunąć tego ucznia? Ta operacja jest nieodwracalna."
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* Cancellations Modal */}
      {isCancellationsModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsCancellationsModalOpen(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Odwołania - {selectedStudent.user.firstName} {selectedStudent.user.lastName}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Historia i limity odwołań lekcji
                  </p>
                </div>
                <button
                  onClick={() => setIsCancellationsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <StudentCancellationsTab student={selectedStudent} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setIsCancellationsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
