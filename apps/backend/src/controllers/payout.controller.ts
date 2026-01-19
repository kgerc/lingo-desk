import { Response } from 'express';
import { TeacherPayoutStatus } from '@prisma/client';
import payoutService from '../services/payout.service';
import { AuthRequest } from '../middleware/auth';

export const previewPayout = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { teacherId } = req.params;
    const { periodStart, periodEnd } = req.query;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: 'periodStart and periodEnd are required' });
    }

    const preview = await payoutService.previewPayout(
      teacherId,
      organizationId,
      new Date(periodStart as string),
      new Date(periodEnd as string)
    );

    return res.json(preview);
  } catch (error) {
    console.error('Preview payout error:', error);
    return res.status(500).json({ error: 'Failed to preview payout' });
  }
};

export const createPayout = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { teacherId, periodStart, periodEnd, notes } = req.body;

    if (!teacherId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'teacherId, periodStart and periodEnd are required' });
    }

    const result = await payoutService.createPayout({
      organizationId,
      teacherId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      notes,
    });

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Create payout error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create payout' });
  }
};

export const getPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { teacherId, status, periodStart, periodEnd } = req.query;

    const filters: any = {};

    if (teacherId) {
      filters.teacherId = teacherId as string;
    }

    if (status) {
      filters.status = status as TeacherPayoutStatus;
    }

    if (periodStart) {
      filters.periodStart = new Date(periodStart as string);
    }

    if (periodEnd) {
      filters.periodEnd = new Date(periodEnd as string);
    }

    const payouts = await payoutService.getPayouts(organizationId, filters);
    return res.json(payouts);
  } catch (error) {
    console.error('Get payouts error:', error);
    return res.status(500).json({ error: 'Failed to get payouts' });
  }
};

export const getPayoutById = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const payout = await payoutService.getPayoutById(id, organizationId);
    return res.json(payout);
  } catch (error: any) {
    console.error('Get payout error:', error);
    if (error.message === 'Payout not found') {
      return res.status(404).json({ error: 'Payout not found' });
    }
    return res.status(500).json({ error: 'Failed to get payout' });
  }
};

export const getTeacherPayouts = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { teacherId } = req.params;

    const payouts = await payoutService.getTeacherPayouts(teacherId, organizationId);
    return res.json(payouts);
  } catch (error) {
    console.error('Get teacher payouts error:', error);
    return res.status(500).json({ error: 'Failed to get teacher payouts' });
  }
};

export const updatePayoutStatus = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !Object.values(TeacherPayoutStatus).includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const payout = await payoutService.updatePayoutStatus(id, organizationId, status, notes);
    return res.json(payout);
  } catch (error: any) {
    console.error('Update payout status error:', error);
    if (error.message === 'Payout not found') {
      return res.status(404).json({ error: 'Payout not found' });
    }
    return res.status(500).json({ error: 'Failed to update payout status' });
  }
};

export const deletePayout = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    await payoutService.deletePayout(id, organizationId);
    return res.status(204).send();
  } catch (error: any) {
    console.error('Delete payout error:', error);
    if (error.message === 'Payout not found') {
      return res.status(404).json({ error: 'Payout not found' });
    }
    if (error.message === 'Only pending payouts can be deleted') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to delete payout' });
  }
};

export const getTeachersSummary = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const summary = await payoutService.getTeachersSummary(organizationId);
    return res.json(summary);
  } catch (error) {
    console.error('Get teachers summary error:', error);
    return res.status(500).json({ error: 'Failed to get teachers summary' });
  }
};

export const getLessonsForDay = async (req: AuthRequest, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { teacherId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const lessons = await payoutService.getLessonsForDay(
      teacherId,
      organizationId,
      new Date(date as string)
    );

    return res.json(lessons);
  } catch (error: any) {
    console.error('Get lessons for day error:', error);
    if (error.message === 'Teacher not found') {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    return res.status(500).json({ error: 'Failed to get lessons' });
  }
};
