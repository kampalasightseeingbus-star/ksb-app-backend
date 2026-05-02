import { Router } from 'express';
import {
  getAllSchedules,
  createSchedule,
  updateScheduleStatus,
  deleteSchedule,
} from '../controllers/scheduleController';
import { authenticate, authorizeAdmin, authorizeDriver } from '../middleware/auth';

const router = Router();

// Admin
router.get('/', authenticate, authorizeAdmin, getAllSchedules);
router.post('/', authenticate, authorizeAdmin, createSchedule);
router.delete('/:id', authenticate, authorizeAdmin, deleteSchedule);

// Admin + Driver
router.put('/:id/status', authenticate, authorizeDriver, updateScheduleStatus);

export default router;
