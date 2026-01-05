import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import paymentService, { Payment, CreatePaymentData, UpdatePaymentData } from '../services/paymentService';
import { studentService } from '../services/studentService';
import { X } from 'lucide-react';

interface PaymentModalProps {
  payment: Payment | null;
  onClose: () => void;
}

export default function PaymentModal({ payment, onClose }: PaymentModalProps) {
  const queryClient = useQueryClient();
  const isEditMode = Boolean(payment);

  const [formData, setFormData] = useState<CreatePaymentData>({
    studentId: payment?.studentId || '',
    enrollmentId: payment?.enrollmentId || '',
    amount: payment?.amount || 0,
    currency: payment?.currency || 'PLN',
    status: payment?.status || 'PENDING',
    paymentMethod: payment?.paymentMethod || 'CASH',
    notes: payment?.notes || '',
    paidAt: payment?.paidAt ? new Date(payment.paidAt).toISOString().slice(0, 16) : '',
  });

  // Fetch students for dropdown
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => studentService.getStudents(),
  });

  // Fetch enrollments for selected student
  const { data: selectedStudent } = useQuery({
    queryKey: ['student', formData.studentId],
    queryFn: () => studentService.getStudent(formData.studentId),
    enabled: !!formData.studentId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePaymentData) => paymentService.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePaymentData) =>
      paymentService.updatePayment(payment!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode) {
      updateMutation.mutate({
        amount: formData.amount,
        status: formData.status,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        paidAt: formData.paidAt || undefined,
      });
    } else {
      createMutation.mutate({
        ...formData,
        paidAt: formData.paidAt || undefined,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edytuj płatność' : 'Dodaj płatność'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Student Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uczeń *
            </label>
            <select
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              required
              disabled={isEditMode}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Wybierz ucznia</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.user.firstName} {student.user.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Enrollment Select */}
          {formData.studentId && selectedStudent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kurs (opcjonalnie)
              </label>
              <select
                name="enrollmentId"
                value={formData.enrollmentId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              >
                <option value="">Brak przypisania do kursu</option>
                {selectedStudent.enrollments?.map((enrollment) => (
                  <option key={enrollment.id} value={enrollment.id}>
                    {enrollment.course?.name || 'Nieznany kurs'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kwota *
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              />
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Waluta
              </label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              >
                <option value="PLN">PLN</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metoda płatności *
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              >
                <option value="CASH">Gotówka</option>
                <option value="BANK_TRANSFER">Przelew</option>
                <option value="CARD">Karta</option>
                <option value="ONLINE">Online</option>
                <option value="OTHER">Inne</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              >
                <option value="PENDING">Oczekująca</option>
                <option value="COMPLETED">Opłacona</option>
                <option value="FAILED">Niepowodzenie</option>
                <option value="REFUNDED">Zwrócona</option>
              </select>
            </div>
          </div>

          {/* Paid At */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data płatności
            </label>
            <input
              type="datetime-local"
              name="paidAt"
              value={formData.paidAt}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notatki
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary focus:border-transparent"
              placeholder="Dodatkowe informacje o płatności..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Zapisywanie...'
                : isEditMode
                ? 'Zaktualizuj'
                : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
