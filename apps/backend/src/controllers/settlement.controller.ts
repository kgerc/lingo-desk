import { Response } from 'express';
import { z } from 'zod';
import settlementService from '../services/settlement.service';
import { AuthRequest } from '../middleware/auth';
import {
  requiredUuid,
  requiredDateString,
  optionalString,
  messages,
} from '../utils/validation-messages';

// Validation schemas
const previewSettlementSchema = z.object({
  studentId: requiredUuid('Uczeń'),
  periodStart: requiredDateString('Data początku okresu'),
  periodEnd: requiredDateString('Data końca okresu'),
});

const createSettlementSchema = z.object({
  studentId: requiredUuid('Uczeń'),
  periodStart: requiredDateString('Data początku okresu'),
  periodEnd: requiredDateString('Data końca okresu'),
  notes: optionalString('Notatki'),
});

/**
 * Get students list with balance info for settlement overview
 */
export const getStudentsWithBalance = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: messages.system.unauthorized });
    }

    const students = await settlementService.getStudentsWithBalance(organizationId);
    return res.status(200).json(students);
  } catch (error) {
    console.error('Error getting students with balance:', error);
    return res.status(500).json({ message: 'Nie udało się pobrać listy uczniów' });
  }
};

/**
 * Get last settlement date for a student
 */
export const getLastSettlementDate = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: messages.system.unauthorized });
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
    return res.status(500).json({ message: 'Nie udało się pobrać informacji o rozliczeniu' });
  }
};

/**
 * Preview settlement (calculate without saving)
 */
export const previewSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: messages.system.unauthorized });
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
      return res.status(400).json({ message: messages.system.validationFailed, errors: error.errors });
    }
    console.error('Error previewing settlement:', error);
    return res.status(500).json({ message: 'Nie udało się wygenerować podglądu rozliczenia' });
  }
};

/**
 * Create and save settlement
 */
export const createSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: messages.system.unauthorized });
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
      return res.status(400).json({ message: messages.system.validationFailed, errors: error.errors });
    }
    console.error('Error creating settlement:', error);
    return res.status(500).json({ message: 'Nie udało się utworzyć rozliczenia' });
  }
};

/**
 * Get all settlements for a student
 */
export const getStudentSettlements = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: messages.system.unauthorized });
    }

    const { studentId } = req.params;

    const settlements = await settlementService.getStudentSettlements(studentId, organizationId);
    return res.status(200).json(settlements);
  } catch (error) {
    console.error('Error getting student settlements:', error);
    return res.status(500).json({ message: 'Nie udało się pobrać rozliczeń' });
  }
};

/**
 * Get settlement by ID
 */
export const getSettlementById = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: messages.system.unauthorized });
    }

    const { id } = req.params;

    const settlement = await settlementService.getSettlementById(id, organizationId);
    return res.status(200).json(settlement);
  } catch (error: any) {
    if (error.message === 'Settlement not found') {
      return res.status(404).json({ message: 'Nie znaleziono rozliczenia' });
    }
    console.error('Error getting settlement:', error);
    return res.status(500).json({ message: 'Nie udało się pobrać rozliczenia' });
  }
};

/**
 * Delete settlement (only most recent)
 */
export const deleteSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: messages.system.unauthorized });
    }

    const { id } = req.params;

    await settlementService.deleteSettlement(id, organizationId);
    return res.status(200).json({ message: 'Rozliczenie zostało usunięte pomyślnie' });
  } catch (error: any) {
    if (error.message === 'Settlement not found') {
      return res.status(404).json({ message: 'Nie znaleziono rozliczenia' });
    }
    if (error.message === 'Only the most recent settlement can be deleted') {
      return res.status(400).json({ message: 'Można usunąć tylko ostatnie rozliczenie' });
    }
    console.error('Error deleting settlement:', error);
    return res.status(500).json({ message: 'Nie udało się usunąć rozliczenia' });
  }
};
