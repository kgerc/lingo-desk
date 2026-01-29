import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import paymentService from '../services/payment.service';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import {
  requiredUuid,
  optionalUuid,
  requiredNonNegative,
  optionalNonNegative,
  optionalString,
  requiredEnum,
  optionalEnum,
  optionalDateString,
  messages,
} from '../utils/validation-messages';

// Polish labels for enums
const paymentStatusLabels = {
  PENDING: 'Oczekująca',
  COMPLETED: 'Zrealizowana',
  FAILED: 'Nieudana',
  REFUNDED: 'Zwrócona',
  CANCELLED: 'Anulowana',
};
const paymentMethodLabels = {
  CASH: 'Gotówka',
  BANK_TRANSFER: 'Przelew',
  CARD: 'Karta',
  ONLINE: 'Online',
  OTHER: 'Inne',
};

const paymentStatusValues = Object.values(PaymentStatus) as [string, ...string[]];
const paymentMethodValues = Object.values(PaymentMethod) as [string, ...string[]];

const createPaymentSchema = z.object({
  studentId: requiredUuid('Uczeń'),
  enrollmentId: optionalUuid('Zapisanie'),
  amount: requiredNonNegative('Kwota'),
  currency: optionalString('Waluta'),
  status: requiredEnum('Status', paymentStatusValues, paymentStatusLabels),
  paymentMethod: requiredEnum('Metoda płatności', paymentMethodValues, paymentMethodLabels),
  notes: optionalString('Notatki'),
  paidAt: optionalDateString('Data płatności'),
  exchangeRateOverride: optionalNonNegative('Kurs wymiany'),
});

const updatePaymentSchema = z.object({
  amount: optionalNonNegative('Kwota'),
  currency: optionalString('Waluta'),
  status: optionalEnum('Status', paymentStatusValues, paymentStatusLabels),
  paymentMethod: optionalEnum('Metoda płatności', paymentMethodValues, paymentMethodLabels),
  notes: optionalString('Notatki'),
  paidAt: optionalDateString('Data płatności'),
  exchangeRateOverride: optionalNonNegative('Kurs wymiany').nullable(),
});

class PaymentController {
  /**
   * Get all payments with filters
   * GET /api/payments
   */
  async getPayments(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { studentId, status, paymentMethod, dateFrom, dateTo, limit, offset, currency, convertToCurrency } = req.query;

      const payments = await paymentService.getPayments({
        organizationId,
        studentId: studentId as string | undefined,
        status: status as PaymentStatus | undefined,
        paymentMethod: paymentMethod as PaymentMethod | undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        currency: currency as string | undefined,
        convertToCurrency: convertToCurrency as string | undefined,
      });

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({
        success: false,
        message: 'Nie udało się pobrać płatności',
      });
    }
  }

  /**
   * Get payment by ID
   * GET /api/payments/:id
   */
  async getPaymentById(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const payment = await paymentService.getPaymentById(id as string, organizationId);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Error fetching payment:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Nie udało się pobrać płatności',
      });
    }
  }

  /**
   * Create payment
   * POST /api/payments
   */
  async createPayment(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const data = createPaymentSchema.parse(req.body);

      const payment = await paymentService.createPayment({
        organizationId,
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        amount: data.amount,
        currency: data.currency,
        status: data.status as PaymentStatus,
        paymentMethod: data.paymentMethod as PaymentMethod,
        notes: data.notes,
        paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
        exchangeRateOverride: data.exchangeRateOverride,
      });

      return res.status(201).json({
        success: true,
        data: payment,
        message: 'Płatność została utworzona pomyślnie',
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      return res.status(500).json({
        success: false,
        message: messages.system.internalError,
      });
    }
  }

  /**
   * Update payment
   * PUT /api/payments/:id
   */
  async updatePayment(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;
      const data = updatePaymentSchema.parse(req.body);

      const payment = await paymentService.updatePayment(id as string, organizationId, {
        amount: data.amount,
        currency: data.currency,
        status: data.status as PaymentStatus | undefined,
        paymentMethod: data.paymentMethod as PaymentMethod | undefined,
        notes: data.notes,
        paidAt: data.paidAt !== undefined ? (data.paidAt ? new Date(data.paidAt) : null) : undefined,
        exchangeRateOverride: data.exchangeRateOverride,
      });

      res.json({
        success: true,
        data: payment,
        message: 'Płatność została zaktualizowana pomyślnie',
      });
    } catch (error) {
      console.error('Error updating payment:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Nie udało się zaktualizować płatności',
      });
    }
  }

  /**
   * Delete payment
   * DELETE /api/payments/:id
   */
  async deletePayment(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      await paymentService.deletePayment(id as string, organizationId);

      res.json({
        success: true,
        message: 'Płatność została usunięta pomyślnie',
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Nie udało się usunąć płatności',
      });
    }
  }

  /**
   * Get payment statistics
   * GET /api/payments/stats
   */
  async getPaymentStats(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const stats = await paymentService.getPaymentStats(organizationId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      res.status(500).json({
        success: false,
        message: 'Nie udało się pobrać statystyk płatności',
      });
    }
  }

  /**
   * Get student payment history
   * GET /api/payments/student/:studentId
   */
  async getStudentPaymentHistory(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { studentId } = req.params;

      const payments = await paymentService.getStudentPaymentHistory(studentId as string, organizationId);

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error('Error fetching student payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Nie udało się pobrać historii płatności',
      });
    }
  }

  /**
   * Get debtors - students with pending payments
   * GET /api/payments/debtors
   */
  async getDebtors(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const debtors = await paymentService.getDebtors(organizationId);

      res.json({
        success: true,
        data: debtors,
      });
    } catch (error) {
      console.error('Error fetching debtors:', error);
      res.status(500).json({
        success: false,
        message: 'Nie udało się pobrać listy dłużników',
      });
    }
  }

  /**
   * Import payments from CSV
   * POST /api/payments/import
   */
  async importPayments(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { csvData } = req.body;

      if (!csvData) {
        return res.status(400).json({
          success: false,
          message: 'Dane CSV są wymagane',
        });
      }

      const results = await paymentService.importPayments(csvData, organizationId);

      return res.json({
        success: true,
        data: results,
        message: `Import zakończony: ${results.success} sukces, ${results.failed} błędów`,
      });
    } catch (error) {
      console.error('Error importing payments:', error);
      return res.status(500).json({
        success: false,
        message: 'Nie udało się zaimportować płatności',
      });
    }
  }
}

export default new PaymentController();
