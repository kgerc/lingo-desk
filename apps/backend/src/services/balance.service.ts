import { BalanceTransactionType } from '@prisma/client';
import prisma from '../utils/prisma';

export interface BalanceUpdateResult {
  budgetId: string;
  previousBalance: number;
  newBalance: number;
  transactionId: string;
}

class BalanceService {
  /**
   * Get or create student budget
   */
  async getOrCreateBudget(studentId: string, organizationId: string) {
    let budget = await prisma.studentBudget.findUnique({
      where: { studentId },
    });

    if (!budget) {
      budget = await prisma.studentBudget.create({
        data: {
          studentId,
          organizationId,
          currentBalance: 0,
          currency: 'PLN',
        },
      });
    }

    return budget;
  }

  /**
   * Get student balance with recent transactions
   */
  async getStudentBalance(studentId: string, organizationId: string) {
    const budget = await this.getOrCreateBudget(studentId, organizationId);

    const recentTransactions = await prisma.balanceTransaction.findMany({
      where: { budgetId: budget.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      balance: Number(budget.currentBalance),
      currency: budget.currency,
      lastUpdatedAt: budget.lastUpdatedAt,
      recentTransactions: recentTransactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
        description: t.description,
        createdAt: t.createdAt,
        lessonId: t.lessonId,
        paymentId: t.paymentId,
      })),
    };
  }

  /**
   * Get full transaction history for a student
   */
  async getTransactionHistory(
    studentId: string,
    organizationId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: BalanceTransactionType;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
    const budget = await this.getOrCreateBudget(studentId, organizationId);
    const { limit = 50, offset = 0, type, dateFrom, dateTo } = options || {};

    const where: any = { budgetId: budget.id };

    if (type) {
      where.type = type;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [transactions, total] = await Promise.all([
      prisma.balanceTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.balanceTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
        currency: t.currency,
        description: t.description,
        lessonId: t.lessonId,
        paymentId: t.paymentId,
        createdBy: t.createdBy,
        metadata: t.metadata,
        createdAt: t.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + transactions.length < total,
      },
      currentBalance: Number(budget.currentBalance),
      currency: budget.currency,
    };
  }

  /**
   * Add deposit (payment received) - increases balance
   */
  async addDeposit(
    studentId: string,
    organizationId: string,
    amount: number,
    paymentId: string,
    description?: string
  ): Promise<BalanceUpdateResult> {
    return await prisma.$transaction(async (tx) => {
      // Get or create budget
      let budget = await tx.studentBudget.findUnique({
        where: { studentId },
      });

      if (!budget) {
        budget = await tx.studentBudget.create({
          data: {
            studentId,
            organizationId,
            currentBalance: 0,
            currency: 'PLN',
          },
        });
      }

      const previousBalance = Number(budget.currentBalance);
      const newBalance = previousBalance + amount;

      // Update budget
      await tx.studentBudget.update({
        where: { id: budget.id },
        data: { currentBalance: newBalance },
      });

      // Create transaction record
      const transaction = await tx.balanceTransaction.create({
        data: {
          budgetId: budget.id,
          type: BalanceTransactionType.DEPOSIT,
          amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          currency: budget.currency,
          description: description || 'Wpłata',
          paymentId,
        },
      });

      return {
        budgetId: budget.id,
        previousBalance,
        newBalance,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Charge for lesson - decreases balance
   * Returns the transaction result or null if lesson was already charged
   */
  async chargeForLesson(
    studentId: string,
    organizationId: string,
    lessonId: string,
    amount: number,
    lessonTitle: string
  ): Promise<BalanceUpdateResult | null> {
    return await prisma.$transaction(async (tx) => {
      // Check if lesson was already charged (prevent double-charging)
      const existingCharge = await tx.balanceTransaction.findFirst({
        where: {
          lessonId,
          type: BalanceTransactionType.LESSON_CHARGE,
        },
      });

      if (existingCharge) {
        console.log(`Lesson ${lessonId} already charged, skipping`);
        return null;
      }

      // Get or create budget
      let budget = await tx.studentBudget.findUnique({
        where: { studentId },
      });

      if (!budget) {
        budget = await tx.studentBudget.create({
          data: {
            studentId,
            organizationId,
            currentBalance: 0,
            currency: 'PLN',
          },
        });
      }

      const previousBalance = Number(budget.currentBalance);
      const newBalance = previousBalance - amount; // Can go negative (debt)

      // Update budget
      await tx.studentBudget.update({
        where: { id: budget.id },
        data: { currentBalance: newBalance },
      });

      // Create transaction record
      const transaction = await tx.balanceTransaction.create({
        data: {
          budgetId: budget.id,
          type: BalanceTransactionType.LESSON_CHARGE,
          amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          currency: budget.currency,
          description: `Lekcja: ${lessonTitle}`,
          lessonId,
        },
      });

      return {
        budgetId: budget.id,
        previousBalance,
        newBalance,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Refund for lesson (when uncompleting) - increases balance
   * Only refunds if there was a previous charge
   */
  async refundLesson(
    studentId: string,
    _organizationId: string, // Kept for API consistency
    lessonId: string,
    lessonTitle: string
  ): Promise<BalanceUpdateResult | null> {
    return await prisma.$transaction(async (tx) => {
      // Find the original charge
      const originalCharge = await tx.balanceTransaction.findFirst({
        where: {
          lessonId,
          type: BalanceTransactionType.LESSON_CHARGE,
        },
      });

      if (!originalCharge) {
        console.log(`No charge found for lesson ${lessonId}, skipping refund`);
        return null;
      }

      // Check if already refunded
      const existingRefund = await tx.balanceTransaction.findFirst({
        where: {
          lessonId,
          type: BalanceTransactionType.LESSON_REFUND,
        },
      });

      if (existingRefund) {
        console.log(`Lesson ${lessonId} already refunded, skipping`);
        return null;
      }

      const budget = await tx.studentBudget.findUnique({
        where: { studentId },
      });

      if (!budget) {
        throw new Error('Budget not found for refund');
      }

      const amount = Number(originalCharge.amount);
      const previousBalance = Number(budget.currentBalance);
      const newBalance = previousBalance + amount;

      // Update budget
      await tx.studentBudget.update({
        where: { id: budget.id },
        data: { currentBalance: newBalance },
      });

      // Create refund transaction
      const transaction = await tx.balanceTransaction.create({
        data: {
          budgetId: budget.id,
          type: BalanceTransactionType.LESSON_REFUND,
          amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          currency: budget.currency,
          description: `Zwrot za lekcję: ${lessonTitle}`,
          lessonId,
        },
      });

      return {
        budgetId: budget.id,
        previousBalance,
        newBalance,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Charge cancellation fee - decreases balance
   */
  async chargeCancellationFee(
    studentId: string,
    organizationId: string,
    lessonId: string,
    amount: number,
    lessonTitle: string
  ): Promise<BalanceUpdateResult> {
    return await prisma.$transaction(async (tx) => {
      let budget = await tx.studentBudget.findUnique({
        where: { studentId },
      });

      if (!budget) {
        budget = await tx.studentBudget.create({
          data: {
            studentId,
            organizationId,
            currentBalance: 0,
            currency: 'PLN',
          },
        });
      }

      const previousBalance = Number(budget.currentBalance);
      const newBalance = previousBalance - amount;

      await tx.studentBudget.update({
        where: { id: budget.id },
        data: { currentBalance: newBalance },
      });

      const transaction = await tx.balanceTransaction.create({
        data: {
          budgetId: budget.id,
          type: BalanceTransactionType.CANCELLATION_FEE,
          amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          currency: budget.currency,
          description: `Opłata za odwołanie: ${lessonTitle}`,
          lessonId,
        },
      });

      return {
        budgetId: budget.id,
        previousBalance,
        newBalance,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Manual adjustment by admin - can increase or decrease balance
   */
  async adjustBalance(
    studentId: string,
    organizationId: string,
    amount: number, // Positive = add, Negative = subtract
    description: string,
    createdBy: string
  ): Promise<BalanceUpdateResult> {
    return await prisma.$transaction(async (tx) => {
      let budget = await tx.studentBudget.findUnique({
        where: { studentId },
      });

      if (!budget) {
        budget = await tx.studentBudget.create({
          data: {
            studentId,
            organizationId,
            currentBalance: 0,
            currency: 'PLN',
          },
        });
      }

      const previousBalance = Number(budget.currentBalance);
      const newBalance = previousBalance + amount;

      await tx.studentBudget.update({
        where: { id: budget.id },
        data: { currentBalance: newBalance },
      });

      const transaction = await tx.balanceTransaction.create({
        data: {
          budgetId: budget.id,
          type: BalanceTransactionType.ADJUSTMENT,
          amount: Math.abs(amount),
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          currency: budget.currency,
          description,
          createdBy,
          metadata: { adjustmentType: amount >= 0 ? 'CREDIT' : 'DEBIT' },
        },
      });

      return {
        budgetId: budget.id,
        previousBalance,
        newBalance,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Check if a lesson was already charged
   */
  async isLessonCharged(lessonId: string): Promise<boolean> {
    const charge = await prisma.balanceTransaction.findFirst({
      where: {
        lessonId,
        type: BalanceTransactionType.LESSON_CHARGE,
      },
    });

    return !!charge;
  }

  /**
   * Revert a deposit (when payment is un-completed)
   */
  async revertDeposit(
    studentId: string,
    paymentId: string,
    description?: string
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ): Promise<BalanceUpdateResult | null> {
    return await prisma.$transaction(async (tx) => {
      // Find the original deposit
      const originalDeposit = await tx.balanceTransaction.findFirst({
        where: {
          paymentId,
          type: BalanceTransactionType.DEPOSIT,
        },
      });

      if (!originalDeposit) {
        console.log(`No deposit found for payment ${paymentId}, skipping revert`);
        return null;
      }

      const budget = await tx.studentBudget.findUnique({
        where: { studentId },
      });

      if (!budget) {
        throw new Error('Budget not found for deposit revert');
      }

      const amount = Number(originalDeposit.amount);
      const previousBalance = Number(budget.currentBalance);
      const newBalance = previousBalance - amount;

      await tx.studentBudget.update({
        where: { id: budget.id },
        data: { currentBalance: newBalance },
      });

      const transaction = await tx.balanceTransaction.create({
        data: {
          budgetId: budget.id,
          type: BalanceTransactionType.REFUND,
          amount,
          balanceBefore: previousBalance,
          balanceAfter: newBalance,
          currency: budget.currency,
          description: description || 'Cofnięcie wpłaty',
          paymentId,
        },
      });

      return {
        budgetId: budget.id,
        previousBalance,
        newBalance,
        transactionId: transaction.id,
      };
    });
  }
}

export default new BalanceService();
