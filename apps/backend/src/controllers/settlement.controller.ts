import { Response } from 'express';
import { z } from 'zod';
import settlementService from '../services/settlement.service';
import { AuthRequest } from '../middleware/auth';

// Validation schemas
const previewSettlementSchema = z.object({
  studentId: z.string().uuid(),
  periodStart: z.string().transform((val) => new Date(val)),
  periodEnd: z.string().transform((val) => new Date(val)),
});

const createSettlementSchema = z.object({
  studentId: z.string().uuid(),
  periodStart: z.string().transform((val) => new Date(val)),
  periodEnd: z.string().transform((val) => new Date(val)),
  notes: z.string().optional(),
});

/**
 * Get students list with balance info for settlement overview
 */
export const getStudentsWithBalance = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const students = await settlementService.getStudentsWithBalance(organizationId);
    return res.status(200).json(students);
  } catch (error) {
    console.error('Error getting students with balance:', error);
    return res.status(500).json({ message: 'Failed to get students' });
  }
};

/**
 * Get last settlement date for a student
 */
export const getLastSettlementDate = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { studentId } = req.params;

    const lastDate = await settlementService.getLastSettlementDate(studentId, organizationId);
    const currentBalance = await settlementService.getCurrentBalance(studentId, organizationId);

    return res.status(200).json({
      lastSettlementDate: lastDate,
      currentBalance,
    });
  } catch (error) {
    console.error('Error getting last settlement date:', error);
    return res.status(500).json({ message: 'Failed to get settlement info' });
  }
};

/**
 * Preview settlement (calculate without saving)
 */
export const previewSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validatedData = previewSettlementSchema.parse(req.body);

    const preview = await settlementService.previewSettlement(
      validatedData.studentId,
      organizationId,
      validatedData.periodStart,
      validatedData.periodEnd
    );

    return res.status(200).json(preview);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error previewing settlement:', error);
    return res.status(500).json({ message: 'Failed to preview settlement' });
  }
};

/**
 * Create and save settlement
 */
export const createSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validatedData = createSettlementSchema.parse(req.body);

    const result = await settlementService.createSettlement({
      organizationId,
      studentId: validatedData.studentId,
      periodStart: validatedData.periodStart,
      periodEnd: validatedData.periodEnd,
      notes: validatedData.notes,
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error creating settlement:', error);
    return res.status(500).json({ message: 'Failed to create settlement' });
  }
};

/**
 * Get all settlements for a student
 */
export const getStudentSettlements = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { studentId } = req.params;

    const settlements = await settlementService.getStudentSettlements(studentId, organizationId);
    return res.status(200).json(settlements);
  } catch (error) {
    console.error('Error getting student settlements:', error);
    return res.status(500).json({ message: 'Failed to get settlements' });
  }
};

/**
 * Get settlement by ID
 */
export const getSettlementById = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    const settlement = await settlementService.getSettlementById(id, organizationId);
    return res.status(200).json(settlement);
  } catch (error: any) {
    if (error.message === 'Settlement not found') {
      return res.status(404).json({ message: 'Settlement not found' });
    }
    console.error('Error getting settlement:', error);
    return res.status(500).json({ message: 'Failed to get settlement' });
  }
};

/**
 * Delete settlement (only most recent)
 */
export const deleteSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { id } = req.params;

    await settlementService.deleteSettlement(id, organizationId);
    return res.status(200).json({ message: 'Settlement deleted successfully' });
  } catch (error: any) {
    if (error.message === 'Settlement not found') {
      return res.status(404).json({ message: 'Settlement not found' });
    }
    if (error.message === 'Only the most recent settlement can be deleted') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error deleting settlement:', error);
    return res.status(500).json({ message: 'Failed to delete settlement' });
  }
};
