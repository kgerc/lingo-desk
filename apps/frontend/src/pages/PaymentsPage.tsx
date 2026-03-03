import { useState, useMemo } from 'react';
import { displayEmail } from '../utils/email';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import paymentService, { Payment } from '../services/paymentService';
import { Plus, Trash2, Edit, DollarSign, Clock, CheckCircle, XCircle, Upload, Calculator, CreditCard, Bell, Settings, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import PaymentModal from '../components/PaymentModal';
import ImportPaymentsModal from '../components/ImportPaymentsModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import SettlementsTab from '../components/SettlementsTab';
import PaymentSettingsTab from '../components/PaymentSettingsTab';

type TabType = 'payments' | 'settlements' | 'settings';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get initial values from URL params
  const initialTab = (searchParams.get('tab') as TabType) || 'settlements';
  const initialStudentId = searchParams.get('studentId') || undefined;
  const initialCourseId = searchParams.get('courseId') || undefined;

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [preselectedStudentId, setPreselectedStudentId] = useState<string | undefined>(initialStudentId);
  const [preselectedCourseId, setPreselectedCourseId] = useState<string | undefined>(initialCourseId);

  // Handle tab change and update URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'payments') {
      // Clear URL params when switching to payments tab
      setSearchParams({});
      setPreselectedStudentId(undefined);
      setPreselectedCourseId(undefined);
    }
  };

  // Clear preselected student after it's been used
  const handleStudentSelected = () => {
    setPreselectedStudentId(undefined);
    // Clear URL params
    setSearchParams({});
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount' | 'paidAt' | 'student' | 'course'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; paymentId: string | null }>({ isOpen: false, paymentId: null });
  const [reminderDialog, setReminderDialog] = useState<{ isOpen: boolean; paymentId: string | null; studentName: string }>({ isOpen: false, paymentId: null, studentName: '' });

  // Fetch payments (filters server-side, sorting client-side)
  const { data: rawPayments = [] as Payment[], isLoading } = useQuery({
    queryKey: ['payments', searchTerm, statusFilter, filterValues],
    queryFn: () => paymentService.getPayments({
      search: searchTerm || undefined,
      status: statusFilter as any || undefined,
      currency: filterValues['currency'] || undefined,
      convertToCurrency: filterValues['convertToCurrency'] || undefined,
      dateFrom: filterValues['dateFrom'] || undefined,
      dateTo: filterValues['dateTo'] || undefined,
    }),
    enabled: activeTab === 'payments',
  });

  const payments = useMemo(() => {
    const paymentMethodFilter = filterValues['paymentMethod'] || '';
    const filtered = paymentMethodFilter
      ? rawPayments.filter((p) => p.paymentMethod === paymentMethodFilter)
      : rawPayments;

    const dir = sortOrder === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'createdAt') return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (sortBy === 'amount') return dir * (a.amount - b.amount);
      if (sortBy === 'paidAt') {
        const aTime = a.paidAt ? new Date(a.paidAt).getTime() : 0;
        const bTime = b.paidAt ? new Date(b.paidAt).getTime() : 0;
        return dir * (aTime - bTime);
      }
      if (sortBy === 'student') {
        const aName = a.student ? `${a.student.user.lastName}${a.student.user.firstName}` : '';
        const bName = b.student ? `${b.student.user.lastName}${b.student.user.firstName}` : '';
        return dir * aName.localeCompare(bName, 'pl');
      }
      if (sortBy === 'course') {
        const aName = a.enrollment?.course?.name || '';
        const bName = b.enrollment?.course?.name || '';
        return dir * aName.localeCompare(bName, 'pl');
      }
      return 0;
    });
  }, [rawPayments, filterValues, sortBy, sortOrder]);

  // Fetch payment stats
  const { data: stats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: () => paymentService.getPaymentStats(),
    enabled: activeTab === 'payments',
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentService.deletePayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      toast.success('Płatność została pomyślnie usunięta');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Błąd usuwania płatności');
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: (paymentId: string) => paymentService.sendReminder(paymentId),
    onSuccess: () => {
      toast.success('Przypomnienie zostało wysłane');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Nie udało się wysłać przypomnienia');
    },
  });

  const handleSendReminderClick = (payment: Payment) => {
    const studentName = payment.student
      ? `${payment.student.user.firstName} ${payment.student.user.lastName}`
      : 'ucznia';
    setReminderDialog({ isOpen: true, paymentId: payment.id, studentName });
  };

  const confirmSendReminder = async () => {
    if (!reminderDialog.paymentId) return;

    // Check if we can send reminder
    try {
      const status = await paymentService.getReminderStatus(reminderDialog.paymentId);
      if (!status.canSend) {
        toast.error(status.reason || 'Nie można wysłać przypomnienia');
        return;
      }
      sendReminderMutation.mutate(reminderDialog.paymentId);
    } catch {
      sendReminderMutation.mutate(reminderDialog.paymentId);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, paymentId: id });
  };

  const confirmDelete = () => {
    if (confirmDialog.paymentId) {
      deleteMutation.mutate(confirmDialog.paymentId);
    }
  };

  const handleEdit = (payment: Payment) => {
    setSelectedPayment(payment);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedPayment(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPayment(null);
  };

  // Payments are now filtered server-side

  const handleSort = (column: 'createdAt' | 'amount' | 'paidAt' | 'student' | 'course') => {
    if (sortBy === column) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }: { column: 'createdAt' | 'amount' | 'paidAt' | 'student' | 'course' }) => {
    if (sortBy !== column) return <ChevronsUpDown className="inline ml-1 h-3.5 w-3.5 text-gray-400" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="inline ml-1 h-3.5 w-3.5 text-primary" />
      : <ChevronDown className="inline ml-1 h-3.5 w-3.5 text-primary" />;
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1"><Clock className="w-3 h-3" /> Oczekująca</span>,
      COMPLETED: <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Opłacona</span>,
      FAILED: <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1"><XCircle className="w-3 h-3" /> Niepowodzenie</span>,
      REFUNDED: <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">Zwrócona</span>,
    };
    return badges[status as keyof typeof badges] || status;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      CASH: 'Gotówka',
      BANK_TRANSFER: 'Przelew',
      CARD: 'Karta',
      ONLINE: 'Online',
      OTHER: 'Inne',
    };
    return labels[method as keyof typeof labels] || method;
  };

  const tabs = [
    { id: 'settlements' as TabType, name: 'Rozliczenia', icon: Calculator },
    { id: 'payments' as TabType, name: 'Wpłaty', icon: CreditCard },
    { id: 'settings' as TabType, name: 'Ustawienia', icon: Settings },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rozliczenia i wpłaty</h1>
          <p className="text-gray-600 mt-1">Zarządzaj rozliczeniami i wpłatami uczniów</p>
        </div>
        {activeTab === 'payments' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300"
            >
              <Upload className="w-5 h-5" />
              Import CSV
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Dodaj wpłatę
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'payments' && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Całkowity przychód</p>
                    <p className="text-2xl font-bold text-gray-900">{Number(stats.totalRevenue).toFixed(2)} PLN</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <Clock className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Oczekujące</p>
                    <p className="text-2xl font-bold text-gray-900">{Number(stats.pendingRevenue).toFixed(2)} PLN</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Opłacone</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.completedPayments}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Clock className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Oczekujące</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.pendingPayments}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Szukaj po uczniu..."
            filters={[
              { key: 'status', label: 'Status', type: 'select', options: [
                { value: 'PENDING', label: 'Oczekująca' },
                { value: 'COMPLETED', label: 'Opłacona' },
                { value: 'FAILED', label: 'Niepowodzenie' },
                { value: 'REFUNDED', label: 'Zwrócona' },
              ]},
              { key: 'paymentMethod', label: 'Metoda', type: 'select', options: [
                { value: 'CASH', label: 'Gotówka' },
                { value: 'BANK_TRANSFER', label: 'Przelew' },
                { value: 'CARD', label: 'Karta' },
                { value: 'ONLINE', label: 'Online' },
                { value: 'OTHER', label: 'Inne' },
              ]},
              { key: 'currency', label: 'Waluta', type: 'select', options: [
                'PLN','USD','EUR','GBP','CHF','CZK','DKK','NOK','SEK',
              ].map((c) => ({ value: c, label: c })) },
              { key: 'convertToCurrency', label: 'Przelicz na', type: 'select', options: [
                'PLN','USD','EUR','GBP','CHF','CZK','DKK','NOK','SEK',
              ].map((c) => ({ value: c, label: c })) },
              { key: 'dateFrom', label: 'Od daty', type: 'date' },
              { key: 'dateTo', label: 'Do daty', type: 'date' },
            ]}
            filterValues={{ ...filterValues, status: statusFilter }}
            onFilterChange={(key, value) => {
              if (key === 'status') setStatusFilter(value);
              else setFilterValues((prev) => ({ ...prev, [key]: value }));
            }}
            onClearAll={() => {
              setSearchTerm(''); setStatusFilter(''); setFilterValues({});
              setSortBy('createdAt'); setSortOrder('desc');
            }}
            filterCols={6}
          />

          {/* Payments Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                      onClick={() => handleSort('student')}
                    >
                      Uczeń <SortIcon column="student" />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                      onClick={() => handleSort('course')}
                    >
                      Kurs <SortIcon column="course" />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                      onClick={() => handleSort('amount')}
                    >
                      Kwota <SortIcon column="amount" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Metoda
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                      onClick={() => handleSort('paidAt')}
                    >
                      Data płatności <SortIcon column="paidAt" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7}>
                        <LoadingSpinner message="Ładowanie płatności..." />
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        Brak płatności do wyświetlenia
                      </td>
                    </tr>
                  ) : (
                    payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {payment.student?.user.firstName} {payment.student?.user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {displayEmail(payment.student?.user.email) ?? <span className="italic text-gray-400">Brak adresu email</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.enrollment?.course?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {payment.amount} {payment.currency}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {getPaymentMethodLabel(payment.paymentMethod)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(payment.status)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleDateString('pl-PL')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {payment.status === 'PENDING' && (
                              <button
                                onClick={() => handleSendReminderClick(payment)}
                                disabled={sendReminderMutation.isPending}
                                className="text-amber-600 hover:text-amber-700 disabled:opacity-50"
                                title="Wyślij przypomnienie"
                              >
                                <Bell className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(payment)}
                              className="text-secondary hover:text-secondary-dark"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(payment.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'settlements' && (
        <SettlementsTab
          preselectedStudentId={preselectedStudentId}
          onStudentSelected={handleStudentSelected}
          preselectedCourseId={preselectedCourseId}
          onCourseSelected={() => setPreselectedCourseId(undefined)}
        />
      )}

      {activeTab === 'settings' && (
        <PaymentSettingsTab />
      )}

      {/* Payment Modal */}
      {isModalOpen && (
        <PaymentModal payment={selectedPayment} onClose={handleCloseModal} />
      )}

      {/* Import Payments Modal */}
      {isImportModalOpen && (
        <ImportPaymentsModal onClose={() => setIsImportModalOpen(false)} />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, paymentId: null })}
        onConfirm={confirmDelete}
        title="Usuń płatność"
        message="Czy na pewno chcesz usunąć tę płatność? Ta operacja jest nieodwracalna."
        confirmText="Usuń"
        cancelText="Anuluj"
        variant="danger"
      />

      {/* Confirm Send Reminder Dialog */}
      <ConfirmDialog
        isOpen={reminderDialog.isOpen}
        onClose={() => setReminderDialog({ isOpen: false, paymentId: null, studentName: '' })}
        onConfirm={confirmSendReminder}
        title="Wyślij przypomnienie"
        message={`Czy na pewno chcesz wysłać przypomnienie o płatności do ${reminderDialog.studentName}?`}
        confirmText="Wyślij"
        cancelText="Anuluj"
        variant="warning"
      />
    </div>
  );
}
