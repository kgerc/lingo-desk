import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import paymentService, { Payment } from '../services/paymentService';
import { Plus, Search, Trash2, Edit, DollarSign, Clock, CheckCircle, XCircle, Upload } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';
import ImportPaymentsModal from '../components/ImportPaymentsModal';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currencyFilter, setCurrencyFilter] = useState<string>('ALL');
  const [convertToCurrency, setConvertToCurrency] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; paymentId: string | null }>({ isOpen: false, paymentId: null });

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', currencyFilter, convertToCurrency],
    queryFn: () => paymentService.getPayments({
      currency: currencyFilter !== 'ALL' ? currencyFilter : undefined,
      convertToCurrency: convertToCurrency || undefined,
    }),
  });

  // Fetch payment stats
  const { data: stats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn: () => paymentService.getPaymentStats(),
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

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.student?.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.student?.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || payment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Płatności</h1>
          <p className="text-gray-600 mt-1">Zarządzaj płatnościami uczniów</p>
        </div>
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
            Dodaj płatność
          </button>
        </div>
      </div>

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
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Szukaj po uczniu, notatkach..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            >
              <option value="ALL">Wszystkie statusy</option>
              <option value="PENDING">Oczekujące</option>
              <option value="COMPLETED">Opłacone</option>
              <option value="FAILED">Niepowodzenie</option>
              <option value="REFUNDED">Zwrócone</option>
            </select>
          </div>

          <div>
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            >
              <option value="ALL">Wszystkie waluty</option>
              <option value="PLN">PLN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
              <option value="CZK">CZK</option>
              <option value="DKK">DKK</option>
              <option value="NOK">NOK</option>
              <option value="SEK">SEK</option>
            </select>
          </div>

          <div>
            <select
              value={convertToCurrency}
              onChange={(e) => setConvertToCurrency(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            >
              <option value="">Bez konwersji</option>
              <option value="PLN">Przelicz na PLN</option>
              <option value="USD">Przelicz na USD</option>
              <option value="EUR">Przelicz na EUR</option>
              <option value="GBP">Przelicz na GBP</option>
              <option value="CHF">Przelicz na CHF</option>
              <option value="CZK">Przelicz na CZK</option>
              <option value="DKK">Przelicz na DKK</option>
              <option value="NOK">Przelicz na NOK</option>
              <option value="SEK">Przelicz na SEK</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uczeń
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kurs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kwota
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metoda
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data płatności
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
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Brak płatności do wyświetlenia
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {payment.student?.user.firstName} {payment.student?.user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{payment.student?.user.email}</div>
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
    </div>
  );
}
