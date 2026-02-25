import { useState, useEffect, useMemo } from 'react';
import { displayEmail } from '../utils/email';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import settlementService, { StudentWithBalance, SettlementPreview } from '../services/settlementService';
import { courseService } from '../services/courseService';
import { Search, Calculator, Calendar, TrendingUp, TrendingDown, Minus, ChevronRight, ArrowLeft, Save, Trash2, Eye, History } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import ConfirmDialog from './ConfirmDialog';

type ViewMode = 'list' | 'settlement' | 'history';

interface SettlementsTabProps {
  preselectedStudentId?: string;
  onStudentSelected?: () => void;
  preselectedCourseId?: string;
  onCourseSelected?: () => void;
}

export default function SettlementsTab({ preselectedStudentId, onStudentSelected, preselectedCourseId, onCourseSelected }: SettlementsTabProps) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithBalance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>(preselectedCourseId || '');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; settlementId: string | null }>({ isOpen: false, settlementId: null });

  // Fetch students with balance
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['settlements-students'],
    queryFn: () => settlementService.getStudentsWithBalance(),
    enabled: viewMode === 'list',
  });

  // Fetch group courses for filter dropdown
  const { data: groupCourses = [] } = useQuery({
    queryKey: ['group-courses-for-settlement'],
    queryFn: () => courseService.getCourses({ courseType: 'GROUP' }),
    enabled: viewMode === 'list',
  });

  // Fetch student settlement info when selected
  const { data: settlementInfo, isLoading: isLoadingInfo } = useQuery({
    queryKey: ['settlement-info', selectedStudent?.id],
    queryFn: () => settlementService.getStudentSettlementInfo(selectedStudent!.id),
    enabled: !!selectedStudent && viewMode === 'settlement',
  });

  // Fetch student settlements history
  const { data: settlements = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['student-settlements', selectedStudent?.id],
    queryFn: () => settlementService.getStudentSettlements(selectedStudent!.id),
    enabled: !!selectedStudent && viewMode === 'history',
  });

  // Auto-select student when preselectedStudentId is provided
  useEffect(() => {
    if (preselectedStudentId && students.length > 0 && !selectedStudent) {
      const student = students.find((s) => s.id === preselectedStudentId);
      if (student) {
        handleSelectStudent(student);
        onStudentSelected?.();
      }
    }
  }, [preselectedStudentId, students, selectedStudent]);

  // Notify parent that courseId has been consumed
  useEffect(() => {
    if (preselectedCourseId && selectedCourseId === preselectedCourseId) {
      onCourseSelected?.();
    }
  }, [preselectedCourseId, selectedCourseId]);

  // Set default period dates when settlement info is loaded
  useEffect(() => {
    if (settlementInfo && viewMode === 'settlement') {
      if (settlementInfo.lastSettlementDate) {
        // Start from day after last settlement
        const startDate = new Date(settlementInfo.lastSettlementDate);
        startDate.setDate(startDate.getDate() + 1);
        setPeriodStart(startDate.toISOString().split('T')[0]);
      } else {
        // Default to 30 days ago
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        setPeriodStart(startDate.toISOString().split('T')[0]);
      }
      // End date defaults to today
      setPeriodEnd(new Date().toISOString().split('T')[0]);
    }
  }, [settlementInfo, viewMode]);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: () => settlementService.previewSettlement(
      selectedStudent!.id,
      periodStart,
      periodEnd
    ),
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Błąd podczas generowania podglądu');
    },
  });

  // Create settlement mutation
  const createMutation = useMutation({
    mutationFn: () => settlementService.createSettlement({
      studentId: selectedStudent!.id,
      periodStart,
      periodEnd,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Rozliczenie zostało zapisane');
      queryClient.invalidateQueries({ queryKey: ['settlements-students'] });
      queryClient.invalidateQueries({ queryKey: ['student-settlements'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-info'] });
      handleBackToList();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Błąd podczas zapisywania rozliczenia');
    },
  });

  // Delete settlement mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => settlementService.deleteSettlement(id),
    onSuccess: () => {
      toast.success('Rozliczenie zostało usunięte');
      queryClient.invalidateQueries({ queryKey: ['settlements-students'] });
      queryClient.invalidateQueries({ queryKey: ['student-settlements'] });
      queryClient.invalidateQueries({ queryKey: ['settlement-info'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Błąd podczas usuwania rozliczenia');
    },
  });

  const handleSelectStudent = (student: StudentWithBalance) => {
    setSelectedStudent(student);
    setViewMode('settlement');
    setPreview(null);
    setNotes('');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedStudent(null);
    setPreview(null);
    setPeriodStart('');
    setPeriodEnd('');
    setNotes('');
  };

  const handleShowHistory = () => {
    setViewMode('history');
  };

  const handleGeneratePreview = () => {
    if (!periodStart || !periodEnd) {
      toast.error('Wybierz zakres dat');
      return;
    }
    previewMutation.mutate();
  };

  const handleSaveSettlement = () => {
    if (!preview) {
      toast.error('Najpierw wygeneruj podgląd rozliczenia');
      return;
    }
    createMutation.mutate();
  };

  const handleDeleteSettlement = (id: string) => {
    setConfirmDialog({ isOpen: true, settlementId: id });
  };

  const confirmDelete = () => {
    if (confirmDialog.settlementId) {
      deleteMutation.mutate(confirmDialog.settlementId);
    }
  };

  // Get enrolled student IDs from selected course for filtering
  const enrolledStudentIds = useMemo(() => {
    if (!selectedCourseId) return null;
    const course = groupCourses.find((c) => c.id === selectedCourseId);
    return course?.enrollments?.map((e) => e.studentId) || [];
  }, [selectedCourseId, groupCourses]);

  // Filter students by search and optional course filter
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      `${student.firstName} ${student.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = !enrolledStudentIds || enrolledStudentIds.includes(student.id);
    return matchesSearch && matchesCourse;
  });

  const formatCurrency = (amount: number, currency = 'PLN') => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 0) return <TrendingUp className="w-5 h-5 text-green-600" />;
    if (balance < 0) return <TrendingDown className="w-5 h-5 text-red-600" />;
    return <Minus className="w-5 h-5 text-gray-600" />;
  };

  const getBalanceLabel = (balance: number) => {
    if (balance > 0) return 'Nadpłata';
    if (balance < 0) return 'Do zapłaty';
    return 'Rozliczone';
  };

  // Render student list view
  if (viewMode === 'list') {
    return (
      <div>
        {/* Search and Group Filter */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Szukaj ucznia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              />
            </div>
            <div className="w-full md:w-72">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              >
                <option value="">Wszyscy uczniowie</option>
                {groupCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.enrollments?.length || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uczeń
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aktualne saldo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Oczekujące płatności
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ostatnie rozliczenie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoadingStudents ? (
                  <tr>
                    <td colSpan={5}>
                      <LoadingSpinner message="Ładowanie uczniów..." />
                    </td>
                  </tr>
                ) : filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Brak uczniów do wyświetlenia
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {displayEmail(student.email) ?? <span className="italic text-gray-400">Brak adresu email</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getBalanceIcon(student.currentBalance)}
                          <div>
                            <div className={`text-sm font-semibold ${getBalanceColor(student.currentBalance)}`}>
                              {formatCurrency(Math.abs(student.currentBalance))}
                            </div>
                            <div className="text-xs text-gray-500">
                              {getBalanceLabel(student.currentBalance)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {student.pendingPaymentsCount} płatności
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatCurrency(student.pendingPaymentsSum)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {student.lastSettlementDate
                          ? new Date(student.lastSettlementDate).toLocaleDateString('pl-PL')
                          : 'Brak'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleSelectStudent(student)}
                          className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium text-sm"
                        >
                          <Calculator className="w-4 h-4" />
                          Rozlicz
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Render history view
  if (viewMode === 'history') {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setViewMode('settlement')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Historia rozliczeń: {selectedStudent?.firstName} {selectedStudent?.lastName}
              </h2>
              <p className="text-sm text-gray-500">
                {displayEmail(selectedStudent?.email) ?? <span className="italic text-gray-400">Brak adresu email</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Settlements List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {isLoadingHistory ? (
            <LoadingSpinner message="Ładowanie historii..." />
          ) : settlements.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              Brak rozliczeń dla tego ucznia
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {settlements.map((settlement, index) => (
                <div key={settlement.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(settlement.periodStart).toLocaleDateString('pl-PL')} - {new Date(settlement.periodEnd).toLocaleDateString('pl-PL')}
                        </span>
                        <span className="text-xs text-gray-500">
                          Utworzono: {new Date(settlement.createdAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Do zapłaty:</span>
                          <span className="ml-2 font-medium text-red-600">
                            {formatCurrency(Number(settlement.totalPaymentsDue), settlement.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Wpłacono:</span>
                          <span className="ml-2 font-medium text-green-600">
                            {formatCurrency(Number(settlement.totalPaymentsReceived), settlement.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Saldo przed:</span>
                          <span className={`ml-2 font-medium ${getBalanceColor(Number(settlement.balanceBefore))}`}>
                            {formatCurrency(Number(settlement.balanceBefore), settlement.currency)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Saldo po:</span>
                          <span className={`ml-2 font-medium ${getBalanceColor(Number(settlement.balanceAfter))}`}>
                            {formatCurrency(Number(settlement.balanceAfter), settlement.currency)}
                          </span>
                        </div>
                      </div>
                      {settlement.notes && (
                        <p className="mt-2 text-sm text-gray-600">
                          Notatki: {settlement.notes}
                        </p>
                      )}
                    </div>
                    {index === 0 && (
                      <button
                        onClick={() => handleDeleteSettlement(settlement.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Usuń rozliczenie"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ isOpen: false, settlementId: null })}
          onConfirm={confirmDelete}
          title="Usuń rozliczenie"
          message="Czy na pewno chcesz usunąć to rozliczenie? Saldo ucznia zostanie przywrócone do stanu przed rozliczeniem."
          confirmText="Usuń"
          cancelText="Anuluj"
          variant="danger"
        />
      </div>
    );
  }

  // Render settlement view
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackToList}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Rozliczenie: {selectedStudent?.firstName} {selectedStudent?.lastName}
            </h2>
            <p className="text-sm text-gray-500">{selectedStudent?.email}</p>
          </div>
        </div>
        <button
          onClick={handleShowHistory}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <History className="w-5 h-5" />
          Historia rozliczeń
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Settings */}
        <div className="lg:col-span-1 space-y-6">
          {/* Current Balance */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Aktualne saldo</h3>
            {isLoadingInfo ? (
              <LoadingSpinner />
            ) : (
              <div className="flex items-center gap-3">
                {getBalanceIcon(settlementInfo?.currentBalance || 0)}
                <div>
                  <div className={`text-2xl font-bold ${getBalanceColor(settlementInfo?.currentBalance || 0)}`}>
                    {formatCurrency(Math.abs(settlementInfo?.currentBalance || 0))}
                  </div>
                  <div className="text-sm text-gray-500">
                    {getBalanceLabel(settlementInfo?.currentBalance || 0)}
                  </div>
                </div>
              </div>
            )}
            {settlementInfo?.lastSettlementDate && (
              <p className="mt-4 text-sm text-gray-500">
                Ostatnie rozliczenie: {new Date(settlementInfo.lastSettlementDate).toLocaleDateString('pl-PL')}
              </p>
            )}
          </div>

          {/* Period Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Zakres dat</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data początkowa
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                {settlementInfo?.lastSettlementDate && (
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-ustawiono na dzień po ostatnim rozliczeniu
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data końcowa
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notatki (opcjonalnie)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Dodatkowe informacje..."
                />
              </div>
              <button
                onClick={handleGeneratePreview}
                disabled={previewMutation.isPending || !periodStart || !periodEnd}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Eye className="w-5 h-5" />
                {previewMutation.isPending ? 'Generowanie...' : 'Generuj podgląd'}
              </button>
            </div>
          </div>
        </div>

        {/* Right column - Preview */}
        <div className="lg:col-span-2">
          {preview ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Podsumowanie rozliczenia</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-500">Saldo przed</div>
                    <div className={`text-xl font-bold ${getBalanceColor(preview.balanceBefore)}`}>
                      {formatCurrency(preview.balanceBefore, preview.currency)}
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-sm text-red-600">Naliczono (lekcje)</div>
                    <div className="text-xl font-bold text-red-700">
                      {formatCurrency(preview.totalPaymentsDue, preview.currency)}
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600">Wpłaty ucznia</div>
                    <div className="text-xl font-bold text-green-700">
                      {formatCurrency(preview.totalPaymentsReceived, preview.currency)}
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600">Saldo końcowe</div>
                    <div className={`text-xl font-bold ${getBalanceColor(preview.balanceAfter)}`}>
                      {formatCurrency(preview.balanceAfter, preview.currency)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {getBalanceLabel(preview.balanceAfter)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments breakdown */}
              {preview.paymentsBreakdown.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Naliczone płatności ({preview.paymentsBreakdown.length})
                  </h3>
                  <div className="divide-y divide-gray-200">
                    {preview.paymentsBreakdown.map((payment) => (
                      <div key={payment.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{payment.description}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(payment.date).toLocaleDateString('pl-PL')}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-red-600">
                          {formatCurrency(payment.amount, payment.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deposits breakdown */}
              {preview.depositsBreakdown.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Wpłaty ucznia ({preview.depositsBreakdown.length})
                  </h3>
                  <div className="divide-y divide-gray-200">
                    {preview.depositsBreakdown.map((deposit) => (
                      <div key={deposit.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {deposit.paymentMethod === 'CASH' ? 'Gotówka' :
                              deposit.paymentMethod === 'BANK_TRANSFER' ? 'Przelew' :
                                deposit.paymentMethod === 'STRIPE' ? 'Stripe' : deposit.paymentMethod}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(deposit.date).toLocaleDateString('pl-PL')}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-green-600">
                          +{formatCurrency(deposit.amount, deposit.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No data message */}
              {preview.paymentsBreakdown.length === 0 && preview.depositsBreakdown.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center text-gray-500">
                  Brak płatności i wpłat w wybranym okresie
                </div>
              )}

              {/* Save button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSaveSettlement}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {createMutation.isPending ? 'Zapisywanie...' : 'Zapisz rozliczenie'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Calculator className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Wygeneruj podgląd rozliczenia</h3>
              <p className="text-gray-500">
                Wybierz zakres dat i kliknij "Generuj podgląd" aby zobaczyć szczegóły rozliczenia
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
