import { PaymentStatus, PaymentMethod } from '@prisma/client';
import prisma from '../utils/prisma';
import emailService from './email.service';
import exchangeRateService from './exchange-rate.service';
import balanceService from './balance.service';

export interface CreatePaymentData {
  organizationId: string;
  studentId: string;
  enrollmentId?: string;
  amount: number;
  currency?: string;
  exchangeRateOverride?: number; // Manual override of exchange rate
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  paidAt?: Date;
}

export interface UpdatePaymentData {
  amount?: number;
  currency?: string;
  exchangeRateOverride?: number | null;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  notes?: string;
  paidAt?: Date | null;
}

export interface GetPaymentsFilters {
  organizationId: string;
  studentId?: string;
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  currency?: string; // Filter by currency
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  convertToCurrency?: string; // Convert all amounts to this currency
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
      currency,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
      convertToCurrency,
    } = filters;

    const payments = await prisma.payment.findMany({
      where: {
        organizationId,
        ...(studentId && { studentId }),
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...(currency && { currency }),
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

    // If convertToCurrency is specified, convert all amounts
    if (convertToCurrency) {
      const paymentsWithConversion = await Promise.all(
        payments.map(async (payment) => {
          const convertedAmount = await this.convertPaymentAmount(
            payment,
            convertToCurrency,
            organizationId
          );

          return {
            ...payment,
            originalAmount: Number(payment.amount),
            originalCurrency: payment.currency,
            amount: convertedAmount,
            currency: convertToCurrency,
            isConverted: payment.currency !== convertToCurrency,
          };
        })
      );

      return paymentsWithConversion;
    }

    return payments;
  }

  /**
   * Convert payment amount to target currency
   */
  private async convertPaymentAmount(
    payment: any,
    targetCurrency: string,
    organizationId: string
  ): Promise<number> {
    if (payment.currency === targetCurrency) {
      return Number(payment.amount);
    }

    const paymentDate = payment.paidAt || payment.createdAt;

    try {
      let convertedAmount: number;

      // Use exchangeRateOverride if available
      if (payment.exchangeRateOverride) {
        // If we have override, it's the rate to PLN
        const plnAmount = Number(payment.amount) * Number(payment.exchangeRateOverride);

        if (targetCurrency === 'PLN') {
          convertedAmount = plnAmount;
        } else {
          // Convert from PLN to target currency
          convertedAmount = await exchangeRateService.convertFromPLN(
            organizationId,
            plnAmount,
            targetCurrency,
            paymentDate
          );
        }
      } else {
        // Use automatic conversion
        convertedAmount = await exchangeRateService.convert(
          organizationId,
          Number(payment.amount),
          payment.currency,
          targetCurrency,
          paymentDate
        );
      }

      // Round to 2 decimal places
      return Math.round(convertedAmount * 100) / 100;
    } catch (error) {
      console.error(`Error converting payment ${payment.id}:`, error);
      return Number(payment.amount); // Return original amount if conversion fails
    }
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
        enrollmentId: data.enrollmentId || null,
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

    // If payment is created with COMPLETED status, add deposit to student balance
    if (data.status === PaymentStatus.COMPLETED) {
      try {
        await balanceService.addDeposit(
          data.studentId,
          data.organizationId,
          data.amount,
          payment.id,
          data.notes || 'Wpłata'
        );
      } catch (error) {
        console.error('Failed to add deposit to student balance:', error);
        // Don't fail payment creation if balance update fails
      }
    }

    return payment;
  }

  /**
   * Update payment
   */
  async updatePayment(id: string, organizationId: string, data: UpdatePaymentData) {
    // Check if payment exists
    const existingPayment = await this.getPaymentById(id, organizationId);

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
            fileUrl: true,
          },
        },
      },
    });

    // Handle balance updates based on status changes
    const isPaymentCompleted = data.status === 'COMPLETED' && existingPayment.status !== 'COMPLETED';
    const isPaymentUncompleted = existingPayment.status === 'COMPLETED' && data.status && data.status !== 'COMPLETED';

    // Add deposit when payment is marked as completed
    if (isPaymentCompleted) {
      try {
        await balanceService.addDeposit(
          payment.studentId,
          payment.organizationId,
          Number(payment.amount),
          payment.id,
          payment.notes || 'Wpłata'
        );
      } catch (error) {
        console.error('Failed to add deposit to student balance:', error);
      }

      // Send payment confirmation email
      try {
        const paymentMethodNames: Record<string, string> = {
          STRIPE: 'Stripe',
          CASH: 'Gotówka',
          BANK_TRANSFER: 'Przelew bankowy',
        };

        await emailService.sendPaymentConfirmation({
          studentEmail: payment.student.user.email,
          studentName: `${payment.student.user.firstName} ${payment.student.user.lastName}`,
          amount: Number(payment.amount),
          currency: payment.currency,
          paymentMethod: paymentMethodNames[payment.paymentMethod] || payment.paymentMethod,
          courseName: payment.enrollment?.course?.name,
          invoiceUrl: payment.invoice?.fileUrl,
        });
      } catch (emailError) {
        console.error('Failed to send payment confirmation email:', emailError);
      }
    }

    // Revert deposit when payment is un-completed (e.g., refunded or marked as pending)
    if (isPaymentUncompleted) {
      try {
        await balanceService.revertDeposit(
          payment.studentId,
          payment.id,
          `Cofnięcie wpłaty (status: ${data.status})`
        );
      } catch (error) {
        console.error('Failed to revert deposit from student balance:', error);
      }
    }

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

  /**
   * Get debtors - students with pending payments
   * Groups by student and shows total debt
   */
  async getDebtors(organizationId: string) {
    const now = new Date();

    // Get all pending payments that are past due (dueAt is null or <= now)
    const pendingPayments = await prisma.payment.findMany({
      where: {
        organizationId,
        status: PaymentStatus.PENDING,
        OR: [
          { dueAt: null },           // No due date set (immediate debtor)
          { dueAt: { lte: now } },   // Due date has passed
        ],
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group payments by student
    const debtorsMap = new Map<string, {
      student: any;
      totalDebt: number;
      paymentsCount: number;
      oldestPaymentDate: Date;
      payments: any[];
    }>();

    for (const payment of pendingPayments) {
      const studentId = payment.studentId;

      if (!debtorsMap.has(studentId)) {
        debtorsMap.set(studentId, {
          student: payment.student,
          totalDebt: 0,
          paymentsCount: 0,
          oldestPaymentDate: payment.createdAt,
          payments: [],
        });
      }

      const debtor = debtorsMap.get(studentId)!;
      debtor.totalDebt += Number(payment.amount);
      debtor.paymentsCount += 1;
      debtor.payments.push({
        id: payment.id,
        amount: Number(payment.amount),
        createdAt: payment.createdAt,
        dueAt: payment.dueAt,
        notes: payment.notes,
      });

      // Track oldest payment
      if (payment.createdAt < debtor.oldestPaymentDate) {
        debtor.oldestPaymentDate = payment.createdAt;
      }
    }

    // Convert map to array and sort by total debt (highest first)
    const debtors = Array.from(debtorsMap.values())
      .map(debtor => ({
        ...debtor,
        daysSinceOldest: Math.floor(
          (Date.now() - debtor.oldestPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
        ),
      }))
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return debtors;
  }

  /**
   * Import payments from CSV data
   * Supports flexible column names (case-insensitive)
   * Expected columns: date/data, email, amount/kwota, paymentMethod/metodaPlatnosci, status (optional), notes/notatki (optional)
   */
  async importPayments(csvData: string, organizationId: string) {
    const lines = csvData.trim().split('\n');
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data: string }>,
    };

    if (lines.length < 2) {
      results.failed++;
      results.errors.push({
        row: 1,
        error: 'Plik CSV jest pusty lub zawiera tylko nagłówek',
        data: '',
      });
      return results;
    }

    // Parse header row to map column names to indices
    const headerLine = lines[0].trim();
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

    // Map of column name variations
    const findColumnIndex = (aliases: string[]): number => {
      for (const alias of aliases) {
        const index = headers.findIndex(h =>
          h === alias ||
          h.replace(/[^a-z0-9]/g, '') === alias.replace(/[^a-z0-9]/g, '')
        );
        if (index !== -1) return index;
      }
      return -1;
    };

    const dateIdx = findColumnIndex(['date', 'data', 'datum']);
    const emailIdx = findColumnIndex(['email', 'e-mail', 'studentemail', 'uczen']);
    const amountIdx = findColumnIndex(['amount', 'kwota', 'suma', 'wartosc', 'wartość']);
    const methodIdx = findColumnIndex(['paymentmethod', 'metodaplatnosci', 'metoda', 'payment', 'platnosc', 'płatność']);
    const statusIdx = findColumnIndex(['status', 'stan']);
    const notesIdx = findColumnIndex(['notes', 'notatki', 'uwagi', 'note', 'notatka']);

    // Validate required columns
    if (dateIdx === -1 || emailIdx === -1 || amountIdx === -1 || methodIdx === -1) {
      results.failed++;
      results.errors.push({
        row: 1,
        error: 'Brak wymaganych kolumn. Wymagane: data, email, kwota, metoda płatności',
        data: headerLine,
      });
      return results;
    }

    // Process data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parse CSV line (simple split, doesn't handle quoted commas)
        const parts = line.split(',').map(p => p.trim());

        if (parts.length < 4) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: 'Nieprawidłowa liczba kolumn',
            data: line,
          });
          continue;
        }

        const dateStr = parts[dateIdx] || '';
        const studentEmail = parts[emailIdx] || '';
        const amountStr = parts[amountIdx] || '';
        const paymentMethodStr = parts[methodIdx] || '';
        const statusStr = statusIdx !== -1 ? (parts[statusIdx] || 'COMPLETED') : 'COMPLETED';
        const notes = notesIdx !== -1 ? (parts[notesIdx] || '') : '';

        // Parse date (expecting YYYY-MM-DD or DD/MM/YYYY format)
        let paidAt: Date;
        if (dateStr.includes('/')) {
          const [day, month, year] = dateStr.split('/');
          paidAt = new Date(`${year}-${month}-${day}`);
        } else {
          paidAt = new Date(dateStr);
        }

        if (isNaN(paidAt.getTime())) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: `Nieprawidłowy format daty: ${dateStr}`,
            data: line,
          });
          continue;
        }

        // Find student by email
        const student = await prisma.student.findFirst({
          where: {
            organizationId,
            user: {
              email: studentEmail.toLowerCase(),
            },
          },
        });

        if (!student) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: `Nie znaleziono ucznia z emailem: ${studentEmail}`,
            data: line,
          });
          continue;
        }

        // Parse amount
        const amount = parseFloat(amountStr.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: `Nieprawidłowa kwota: ${amountStr}`,
            data: line,
          });
          continue;
        }

        // Parse payment method
        const paymentMethodMap: Record<string, PaymentMethod> = {
          'STRIPE': PaymentMethod.STRIPE,
          'CASH': PaymentMethod.CASH,
          'GOTÓWKA': PaymentMethod.CASH,
          'GOTOWKA': PaymentMethod.CASH,
          'BANK_TRANSFER': PaymentMethod.BANK_TRANSFER,
          'PRZELEW': PaymentMethod.BANK_TRANSFER,
          'TRANSFER': PaymentMethod.BANK_TRANSFER,
        };

        const paymentMethod = paymentMethodMap[paymentMethodStr.toUpperCase()];
        if (!paymentMethod) {
          results.failed++;
          results.errors.push({
            row: i + 1,
            error: `Nieprawidłowa metoda płatności: ${paymentMethodStr} (dozwolone: CASH, BANK_TRANSFER, STRIPE)`,
            data: line,
          });
          continue;
        }

        // Parse status
        const statusMap: Record<string, PaymentStatus> = {
          'PENDING': PaymentStatus.PENDING,
          'OCZEKUJĄCE': PaymentStatus.PENDING,
          'OCZEKUJACE': PaymentStatus.PENDING,
          'COMPLETED': PaymentStatus.COMPLETED,
          'ZAKOŃCZONE': PaymentStatus.COMPLETED,
          'ZAKONCZONE': PaymentStatus.COMPLETED,
          'OPŁACONE': PaymentStatus.COMPLETED,
          'OPLACONE': PaymentStatus.COMPLETED,
          'FAILED': PaymentStatus.FAILED,
          'NIEUDANE': PaymentStatus.FAILED,
          'REFUNDED': PaymentStatus.REFUNDED,
          'ZWRÓCONE': PaymentStatus.REFUNDED,
          'ZWROCONE': PaymentStatus.REFUNDED,
        };

        const status = statusMap[statusStr.toUpperCase()] || PaymentStatus.COMPLETED;

        // Create payment
        await prisma.payment.create({
          data: {
            organizationId,
            studentId: student.id,
            amount,
            currency: 'PLN',
            status,
            paymentMethod,
            paidAt,
            notes: notes || null,
          },
        });

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message || 'Nieznany błąd',
          data: line,
        });
      }
    }

    return results;
  }
}

export default new PaymentService();
