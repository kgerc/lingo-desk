import { PrismaClient, PaymentStatus, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreatePaymentData {
  organizationId: string;
  studentId: string;
  enrollmentId?: string;
  amount: number;
  currency?: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  paidAt?: Date;
}

export interface UpdatePaymentData {
  amount?: number;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  paidAt?: Date;
}

export interface GetPaymentsFilters {
  organizationId: string;
  studentId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

class PaymentService {
  /**
   * Get all payments with filters
   */
  async getPayments(filters: GetPaymentsFilters) {
    const {
      organizationId,
      studentId,
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
    } = filters;

    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        ...(studentId && { studentId }),
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom && { gte: dateFrom }),
                ...(dateTo && { lte: dateTo }),
              },
            }
          : {}),
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        enrollment: {
          include: {
            course: {
              select: {
                name: true,
              },
            },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return payments;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string, organizationId: string) {
    const payment = await prisma.payment.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        enrollment: {
          include: {
            course: {
              select: {
                name: true,
              },
            },
          },
        },
        invoice: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    return payment;
  }

  /**
   * Create new payment
   */
  async createPayment(data: CreatePaymentData) {
    const payment = await prisma.payment.create({
      data: {
        organizationId: data.organizationId,
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        amount: data.amount,
        currency: data.currency || 'PLN',
        status: data.status,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        paidAt: data.paidAt,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return payment;
  }

  /**
   * Update payment
   */
  async updatePayment(id: string, organizationId: string, data: UpdatePaymentData) {
    // Check if payment exists
    await this.getPaymentById(id, organizationId);

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.status && { status: data.status }),
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.paidAt !== undefined && { paidAt: data.paidAt }),
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return payment;
  }

  /**
   * Delete payment
   */
  async deletePayment(id: string, organizationId: string) {
    // Check if payment exists
    await this.getPaymentById(id, organizationId);

    await prisma.payment.delete({
      where: { id },
    });
  }

  /**
   * Get payment statistics for organization
   */
  async getPaymentStats(organizationId: string) {
    const [totalRevenue, pendingRevenue, completedPayments, pendingPayments] =
      await Promise.all([
        // Total revenue (COMPLETED payments)
        prisma.payment.aggregate({
          where: {
            organizationId,
            status: PaymentStatus.COMPLETED,
          },
          _sum: {
            amount: true,
          },
        }),

        // Pending revenue (PENDING payments)
        prisma.payment.aggregate({
          where: {
            organizationId,
            status: PaymentStatus.PENDING,
          },
          _sum: {
            amount: true,
          },
        }),

        // Count completed payments
        prisma.payment.count({
          where: {
            organizationId,
            status: PaymentStatus.COMPLETED,
          },
        }),

        // Count pending payments
        prisma.payment.count({
          where: {
            organizationId,
            status: PaymentStatus.PENDING,
          },
        }),
      ]);

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      pendingRevenue: pendingRevenue._sum.amount || 0,
      completedPayments,
      pendingPayments,
    };
  }

  /**
   * Get student payment history
   */
  async getStudentPaymentHistory(studentId: string, organizationId: string) {
    const payments = await prisma.payment.findMany({
      where: {
        studentId,
        organizationId,
      },
      include: {
        enrollment: {
          include: {
            course: {
              select: {
                name: true,
              },
            },
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return payments;
  }
}

export default new PaymentService();
