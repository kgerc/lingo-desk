import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import paymentService from '../services/payment.service';
import paymentReminderService from '../services/payment-reminder.service';
import csvImportService from '../services/csv-import.service';
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

  /**
   * Send payment reminder
   * POST /api/payments/:id/reminder
   */
  async sendReminder(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const result = await paymentReminderService.sendManualReminder(id, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      return res.json({
        success: true,
        data: { reminderId: result.reminderId },
        message: 'Przypomnienie zostało wysłane',
      });
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      return res.status(500).json({
        success: false,
        message: 'Nie udało się wysłać przypomnienia',
      });
    }
  }

  /**
   * Check if reminder can be sent
   * GET /api/payments/:id/reminder/status
   */
  async getReminderStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const status = await paymentReminderService.canSendReminder(id);

      return res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('Error checking reminder status:', error);
      return res.status(500).json({
        success: false,
        message: 'Nie udało się sprawdzić statusu przypomnienia',
      });
    }
  }

  /**
   * Get payment reminder history
   * GET /api/payments/:id/reminders
   */
  async getPaymentReminders(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      const reminders = await paymentReminderService.getPaymentReminders(id);

      return res.json({
        success: true,
        data: reminders,
      });
    } catch (error) {
      console.error('Error fetching payment reminders:', error);
      return res.status(500).json({
        success: false,
        message: 'Nie udało się pobrać historii przypomnień',
      });
    }
  }
  /**
   * Analyze CSV and propose column mapping
   * POST /api/payments/import/analyze
   */
  async analyzeCsvImport(req: AuthRequest, res: Response) {
    try {
      const { csvData } = req.body;

      if (!csvData) {
        return res.status(400).json({
          success: false,
          message: 'Dane CSV są wymagane',
        });
      }

      const analysis = await csvImportService.analyzeCsv(csvData);

      return res.json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      console.error('Error analyzing CSV:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Nie udało się przeanalizować pliku CSV',
      });
    }
  }

  /**
   * Execute import with confirmed mapping
   * POST /api/payments/import/execute
   */
  async executeCsvImport(req: AuthRequest, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { csvData, mapping, separator } = req.body;

      if (!csvData || !mapping || !separator) {
        return res.status(400).json({
          success: false,
          message: 'csvData, mapping i separator są wymagane',
        });
      }

      const results = await csvImportService.executeImport({
        csvData,
        mapping,
        separator,
        organizationId,
      });

      return res.json({
        success: true,
        data: results,
        message: `Import zakończony: ${results.success} sukces, ${results.failed} błędów`,
      });
    } catch (error: any) {
      console.error('Error executing CSV import:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Nie udało się zaimportować płatności',
      });
    }
  }
}

export default new PaymentController();
