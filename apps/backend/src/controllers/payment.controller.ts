import { Request, Response } from 'express';
import paymentService from '../services/payment.service';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

class PaymentController {
  /**
   * Get all payments with filters
   * GET /api/payments
   */
  async getPayments(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { studentId, status, paymentMethod, dateFrom, dateTo, limit, offset } = req.query;

      const payments = await paymentService.getPayments({
        organizationId,
        studentId: studentId as string | undefined,
        status: status as PaymentStatus | undefined,
        paymentMethod: paymentMethod as PaymentMethod | undefined,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payments',
      });
    }
  }

  /**
   * Get payment by ID
   * GET /api/payments/:id
   */
  async getPaymentById(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      const payment = await paymentService.getPaymentById(id, organizationId);

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error('Error fetching payment:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch payment',
      });
    }
  }

  /**
   * Create payment
   * POST /api/payments
   */
  async createPayment(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { studentId, enrollmentId, amount, currency, status, paymentMethod, notes, paidAt } =
        req.body;

      // Validation
      if (!studentId || !amount || !status || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: studentId, amount, status, paymentMethod',
        });
      }

      const payment = await paymentService.createPayment({
        organizationId,
        studentId,
        enrollmentId,
        amount: parseFloat(amount),
        currency,
        status,
        paymentMethod,
        notes,
        paidAt: paidAt ? new Date(paidAt) : undefined,
      });

      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment created successfully',
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment',
      });
    }
  }

  /**
   * Update payment
   * PUT /api/payments/:id
   */
  async updatePayment(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;
      const { amount, status, paymentMethod, notes, paidAt } = req.body;

      const payment = await paymentService.updatePayment(id, organizationId, {
        amount: amount !== undefined ? parseFloat(amount) : undefined,
        status,
        paymentMethod,
        notes,
        paidAt: paidAt !== undefined ? (paidAt ? new Date(paidAt) : null) : undefined,
      });

      res.json({
        success: true,
        data: payment,
        message: 'Payment updated successfully',
      });
    } catch (error) {
      console.error('Error updating payment:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update payment',
      });
    }
  }

  /**
   * Delete payment
   * DELETE /api/payments/:id
   */
  async deletePayment(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { id } = req.params;

      await paymentService.deletePayment(id, organizationId);

      res.json({
        success: true,
        message: 'Payment deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting payment:', error);
      res.status(404).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete payment',
      });
    }
  }

  /**
   * Get payment statistics
   * GET /api/payments/stats
   */
  async getPaymentStats(req: Request, res: Response) {
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
        message: 'Failed to fetch payment statistics',
      });
    }
  }

  /**
   * Get student payment history
   * GET /api/payments/student/:studentId
   */
  async getStudentPaymentHistory(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { studentId } = req.params;

      const payments = await paymentService.getStudentPaymentHistory(studentId, organizationId);

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error('Error fetching student payment history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch payment history',
      });
    }
  }

  /**
   * Get debtors - students with pending payments
   * GET /api/payments/debtors
   */
  async getDebtors(req: Request, res: Response) {
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
        message: 'Failed to fetch debtors',
      });
    }
  }

  /**
   * Import payments from CSV
   * POST /api/payments/import
   */
  async importPayments(req: Request, res: Response) {
    try {
      const organizationId = req.user!.organizationId;
      const { csvData } = req.body;

      if (!csvData) {
        return res.status(400).json({
          success: false,
          message: 'CSV data is required',
        });
      }

      const results = await paymentService.importPayments(csvData, organizationId);

      res.json({
        success: true,
        data: results,
        message: `Import zakończony: ${results.success} sukces, ${results.failed} błędów`,
      });
    } catch (error) {
      console.error('Error importing payments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import payments',
      });
    }
  }
}

export default new PaymentController();
