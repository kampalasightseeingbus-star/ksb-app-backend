import { Router } from 'express';
import {
  getAllRoutes,
  searchRoutes,
  getRouteById,
  getRouteSchedules,
  createRoute,
  updateRoute,
  deleteRoute,
} from '../controllers/routeController';
import { authenticate, authorizeAdmin } from '../middleware/auth';

const router = Router();

// Public
router.get('/', getAllRoutes);
router.get('/search', searchRoutes);
router.get('/:id', getRouteById);
router.get('/:id/schedules', getRouteSchedules);

// Admin only
router.post('/', authenticate, authorizeAdmin, createRoute);
router.put('/:id', authenticate, authorizeAdmin, updateRoute);
router.delete('/:id', authenticate, authorizeAdmin, deleteRoute);

export default router;
