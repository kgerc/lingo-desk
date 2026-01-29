import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import balanceService from '../services/balance.service';
import prisma from '../utils/prisma';

class BalanceController {
  /**
   * Get student balance and recent transactions
   * GET /api/balance/:studentId
   */
  async getStudentBalance(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      const organizationId = req.user!.organizationId;

      const balance = await balanceService.getStudentBalance(studentId, organizationId);

      res.json(balance);
    } catch (error: any) {
      console.error('Error getting student balance:', error);
      res.status(500).json({ error: error.message || 'Nie udało się pobrać salda ucznia' });
    }
  }

  /**
   * Get full transaction history for a student
   * GET /api/balance/:studentId/transactions
   */
  async getTransactionHistory(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      const organizationId = req.user!.organizationId;
      const { limit, offset, type, dateFrom, dateTo } = req.query;

      const history = await balanceService.getTransactionHistory(studentId, organizationId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        type: type as any,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });

      res.json(history);
    } catch (error: any) {
      console.error('Error getting transaction history:', error);
      res.status(500).json({ error: error.message || 'Nie udało się pobrać historii transakcji' });
    }
  }

  /**
   * Manually adjust student balance (admin only)
   * POST /api/balance/:studentId/adjust
   */
  async adjustBalance(req: AuthRequest, res: Response) {
    try {
      const { studentId } = req.params;
      const organizationId = req.user!.organizationId;
      const userId = req.user!.id;
      const { amount, description } = req.body;

      if (typeof amount !== 'number' || !description) {
        res.status(400).json({ error: 'Amount and description are required' });
        return;
      }

      const result = await balanceService.adjustBalance(
        studentId,
        organizationId,
        amount,
        description,
        userId
      );

      res.json({
        success: true,
        previousBalance: result.previousBalance,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
      });
    } catch (error: any) {
      console.error('Error adjusting balance:', error);
      res.status(500).json({ error: error.message || 'Nie udało się skorygować salda' });
    }
  }

  /**
   * Get current user's balance (for student portal)
   * GET /api/balance/my
   */
  async getMyBalance(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;

      // Find student profile for this user
      const student = await prisma.student.findFirst({
        where: {
          userId,
          organizationId,
        },
      });

      if (!student) {
        res.status(404).json({ error: 'Nie znaleziono profilu ucznia' });
        return;
      }

      const balance = await balanceService.getStudentBalance(student.id, organizationId);

      res.json(balance);
    } catch (error: any) {
      console.error('Error getting my balance:', error);
      res.status(500).json({ error: error.message || 'Nie udało się pobrać salda' });
    }
  }

  /**
   * Get current user's transaction history (for student portal)
   * GET /api/balance/my/transactions
   */
  async getMyTransactionHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;
      const { limit, offset, type, dateFrom, dateTo } = req.query;

      // Find student profile for this user
      const student = await prisma.student.findFirst({
        where: {
          userId,
          organizationId,
        },
      });

      if (!student) {
        res.status(404).json({ error: 'Nie znaleziono profilu ucznia' });
        return;
      }

      const history = await balanceService.getTransactionHistory(student.id, organizationId, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        type: type as any,
        dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo: dateTo ? new Date(dateTo as string) : undefined,
      });

      res.json(history);
    } catch (error: any) {
      console.error('Error getting my transaction history:', error);
      res.status(500).json({ error: error.message || 'Nie udało się pobrać historii transakcji' });
    }
  }
}

export default new BalanceController();
