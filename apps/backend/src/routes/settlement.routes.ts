import express from 'express';
import {
  getStudentsWithBalance,
  getLastSettlementDate,
  getBalanceForecast,
  previewSettlement,
  createSettlement,
  getStudentSettlements,
  getSettlementById,
  deleteSettlement,
} from '../controllers/settlement.controller';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.use(authenticate);

// Get all students with balance info - ADMIN and MANAGER only
router.get('/students', authorize(UserRole.ADMIN, UserRole.MANAGER), getStudentsWithBalance);

// Get last settlement date for a student
router.get('/student/:studentId/info', authorize(UserRole.ADMIN, UserRole.MANAGER), getLastSettlementDate);

// Get balance forecast for a student
router.get('/student/:studentId/forecast', authorize(UserRole.ADMIN, UserRole.MANAGER), getBalanceForecast);

// Get all settlements for a student
router.get('/student/:studentId', authorize(UserRole.ADMIN, UserRole.MANAGER), getStudentSettlements);

// Preview settlement (calculate without saving)
router.post('/preview', authorize(UserRole.ADMIN, UserRole.MANAGER), previewSettlement);

// Create settlement
router.post('/', authorize(UserRole.ADMIN, UserRole.MANAGER), createSettlement);

// Get settlement by ID
router.get('/:id', authorize(UserRole.ADMIN, UserRole.MANAGER), getSettlementById);

// Delete settlement (only most recent)
router.delete('/:id', authorize(UserRole.ADMIN, UserRole.MANAGER), deleteSettlement);

export default router;
