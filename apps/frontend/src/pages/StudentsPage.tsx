import React, { useState, useRef } from 'react';
import { displayEmail } from '../utils/email';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { studentService, Student } from '../services/studentService';
import { Plus, Search, Mail, Phone, MoreVertical, Upload, X, Calculator, Trash2, Loader2, Archive, ArchiveRestore, AlertTriangle, SlidersHorizontal, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
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
  const [sortBy, setSortBy] = useState<string>('studentNumber');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterLevel, setFilterLevel] = useState<string>('');
  const [filterBalanceMin, setFilterBalanceMin] = useState<string>('');
  const [filterBalanceMax, setFilterBalanceMax] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCancellationsModalOpen, setIsCancellationsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; studentId: string | null }>({ isOpen: false, studentId: null });
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoreDialog, setRestoreDialog] = useState<{ isOpen: boolean; studentId: string | null }>({ isOpen: false, studentId: null });
  const [purgeDialog, setPurgeDialog] = useState<{ isOpen: boolean; studentId: string | null }>({ isOpen: false, studentId: null });
  const dropdownTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Check if user has access to settlements (ADMIN, MANAGER, HR)
  const canAccessSettlements = ['ADMIN', 'MANAGER', 'HR'].includes(user?.role || '');

  // Navigate to settlements for a specific student
  const handleGoToSettlements = (student: Student) => {
    navigate(`/payments?tab=settlements&studentId=${student.id}`);
  };

  // Fetch active students
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', searchTerm, sortBy, sortOrder, filterLevel, filterBalanceMin, filterBalanceMax],
    queryFn: () => studentService.getStudents({
      search: searchTerm || undefined,
      sortBy,
      sortOrder,
      languageLevel: filterLevel || undefined,
      balanceMin: filterBalanceMin !== '' ? Number(filterBalanceMin) : undefined,
      balanceMax: filterBalanceMax !== '' ? Number(filterBalanceMax) : undefined,
    }),
  });

  // Fetch archived students
  const { data: archivedStudents = [], isLoading: isLoadingArchived } = useQuery({
    queryKey: ['students', 'archived'],
    queryFn: () => studentService.getArchivedStudents(),
    enabled: activeTab === 'archived',
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => studentService.bulkDeleteStudents(ids),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSelectedIds(new Set());
      if (result.failed === 0) {
        toast.success(`Usunięto ${result.deleted} uczniów`);
      } else {
        toast.error(`Usunięto ${result.deleted}, błędy: ${result.failed}`);
      }
    },
    onError: () => {
      toast.error('Błąd podczas usuwania uczniów');
    },
  });

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map((s) => s.id)));
    }
  };

  // Archive mutation (soft delete)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => studentService.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Uczeń przeniesiony do archiwum');
    },
    onError: () => {
      toast.error('Nie udało się zarchiwizować ucznia');
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: (id: string) => studentService.restoreStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['students', 'archived'] });
      toast.success('Uczeń przywrócony');
    },
    onError: () => {
      toast.error('Nie udało się przywrócić ucznia');
    },
  });

  // Purge mutation (hard delete)
  const purgeMutation = useMutation({
    mutationFn: (id: string) => studentService.purgeStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', 'archived'] });
      toast.success('Uczeń trwale usunięty');
    },
    onError: () => {
      toast.error('Nie udało się trwale usunąć ucznia');
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

  const allSelected = students.length > 0 && selectedIds.size === students.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const activeFiltersCount = [filterLevel, filterBalanceMin, filterBalanceMax].filter(Boolean).length;

  const clearFilters = () => {
    setFilterLevel('');
    setFilterBalanceMin('');
    setFilterBalanceMax('');
    setSortBy('studentNumber');
    setSortOrder('desc');
    setShowFilters(false);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ChevronsUpDown className="inline ml-1 h-3.5 w-3.5 text-gray-400" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="inline ml-1 h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="inline ml-1 h-3.5 w-3.5 text-primary" />;
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'active'
              ? 'bg-white border border-b-white border-gray-200 -mb-px text-secondary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Aktywni ({students.length})
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'archived'
              ? 'bg-white border border-b-white border-gray-200 -mb-px text-secondary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          Archiwum {archivedStudents.length > 0 && `(${archivedStudents.length})`}
        </button>
      </div>

      {/* Search + Filters (active tab only) */}
      {activeTab === 'active' && (
        <div className="bg-white rounded-lg shadow p-4 border border-gray-200 mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Szukaj ucznia po imieniu, nazwisku lub emailu..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtry
              {activeFiltersCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold bg-primary text-white rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                title="Wyczyść filtry"
              >
                <X className="h-4 w-4" />
                Wyczyść
              </button>
            )}
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Poziom językowy</label>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Wszystkie poziomy</option>
                  {['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'].map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Saldo od (zł)</label>
                <input
                  type="number"
                  value={filterBalanceMin}
                  onChange={(e) => setFilterBalanceMin(e.target.value)}
                  placeholder="np. 0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Saldo do (zł)</label>
                <input
                  type="number"
                  value={filterBalanceMax}
                  onChange={(e) => setFilterBalanceMax(e.target.value)}
                  placeholder="np. 500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">
            Zaznaczono {selectedIds.size} {selectedIds.size === 1 ? 'ucznia' : selectedIds.size < 5 ? 'uczniów' : 'uczniów'}
          </span>
          <button
            onClick={() => setBulkConfirmOpen(true)}
            disabled={bulkDeleteMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {bulkDeleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Archiwizuj zaznaczonych
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-blue-600 hover:underline"
          >
            Odznacz wszystkich
          </button>
        </div>
      )}

      {/* Students Table (active) */}
      {activeTab === 'active' && <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
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
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort('studentNumber')}
                  >
                    Nr<SortIcon column="studentNumber" />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort('firstName')}
                  >
                    Uczeń<SortIcon column="firstName" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kontakt
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort('languageLevel')}
                  >
                    Poziom<SortIcon column="languageLevel" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    onClick={() => handleSort('balance')}
                  >
                    Saldo<SortIcon column="balance" />
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
                {students.map((student) => {
                  const isSelected = selectedIds.has(student.id);
                  return (
                  <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="w-10 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggle(student.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                    </td>
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
                          {displayEmail(student.user.email) ?? <span className="italic text-gray-400">Brak adresu email</span>}
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
                            label: 'Archiwizuj ucznia',
                            onClick: () => handleDelete(student.id),
                            variant: 'danger',
                          },
                        ]}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Archive Table */}
      {activeTab === 'archived' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          {isLoadingArchived ? (
            <LoadingSpinner message="Ładowanie archiwum..." />
          ) : archivedStudents.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Archive className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Archiwum jest puste.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uczeń</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data archiwizacji</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trwałe usunięcie za</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {archivedStudents.map((student) => {
                    const days = student.daysUntilDeletion ?? 0;
                    const urgent = days <= 7;
                    return (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                              {student.user.firstName[0]}{student.user.lastName[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {student.user.firstName} {student.user.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {displayEmail(student.user.email) ?? <span className="italic text-gray-400">Brak adresu email</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.archivedAt ? new Date(student.archivedAt).toLocaleDateString('pl-PL') : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-sm font-medium ${urgent ? 'text-red-600' : 'text-amber-600'}`}>
                            {urgent && <AlertTriangle className="h-3.5 w-3.5" />}
                            {days === 0 ? 'Dziś' : `${days} ${days === 1 ? 'dzień' : 'dni'}`}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setRestoreDialog({ isOpen: true, studentId: student.id })}
                              disabled={restoreMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              <ArchiveRestore className="h-4 w-4" />
                              Przywróć
                            </button>
                            {user?.role === 'ADMIN' && (
                              <button
                                onClick={() => setPurgeDialog({ isOpen: true, studentId: student.id })}
                                disabled={purgeMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Usuń permanentnie
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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

      {/* Confirm Archive Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, studentId: null })}
        onConfirm={confirmDelete}
        title="Archiwizuj ucznia"
        message="Uczeń zostanie przeniesiony do archiwum. Możesz go przywrócić w ciągu 30 dni, po tym czasie zostanie trwale usunięty."
        confirmText="Archiwizuj"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* Confirm Bulk Archive Dialog */}
      <ConfirmDialog
        isOpen={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        title="Archiwizuj zaznaczonych uczniów"
        message={`${selectedIds.size} zaznaczonych uczniów zostanie przeniesionych do archiwum. Możesz ich przywrócić w ciągu 30 dni.`}
        confirmText="Archiwizuj"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* Restore Dialog */}
      <ConfirmDialog
        isOpen={restoreDialog.isOpen}
        onClose={() => setRestoreDialog({ isOpen: false, studentId: null })}
        onConfirm={() => {
          if (restoreDialog.studentId) restoreMutation.mutate(restoreDialog.studentId);
        }}
        title="Przywróć ucznia"
        message="Uczeń zostanie przywrócony i będzie widoczny na liście aktywnych uczniów."
        confirmText="Przywróć"
        cancelText="Anuluj"
        variant="info"
      />

      {/* Purge Dialog */}
      <ConfirmDialog
        isOpen={purgeDialog.isOpen}
        onClose={() => setPurgeDialog({ isOpen: false, studentId: null })}
        onConfirm={() => {
          if (purgeDialog.studentId) purgeMutation.mutate(purgeDialog.studentId);
        }}
        title="Trwałe usunięcie ucznia"
        message="Uczeń zostanie nieodwracalnie usunięty wraz z całą historią. Tej operacji nie można cofnąć."
        confirmText="Usuń permanentnie"
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
