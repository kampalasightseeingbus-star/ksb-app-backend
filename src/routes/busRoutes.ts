import { Router } from 'express';
import {
  getAllBuses,
  createBus,
  updateBus,
  updateBusLocation,
  getBusLocation,
  getDriverSchedule,
  getPassengerManifest,
  markApproachingStop,
  markArrivedAtStop,
  markTripComplete,
} from '../controllers/busController';
import { authenticate, authorizeAdmin, authorizeDriver } from '../middleware/auth';

const router = Router();

// Admin
router.get('/', authenticate, authorizeAdmin, getAllBuses);
router.post('/', authenticate, authorizeAdmin, createBus);
router.put('/:id', authenticate, authorizeAdmin, updateBus);

// Driver
router.post('/location', authenticate, authorizeDriver, updateBusLocation);
router.get('/my-schedule', authenticate, authorizeDriver, getDriverSchedule);
router.get('/manifest/:schedule_id', authenticate, authorizeDriver, getPassengerManifest);
router.post('/approaching-stop', authenticate, authorizeDriver, markApproachingStop);
router.post('/arrived-at-stop', authenticate, authorizeDriver, markArrivedAtStop);
router.post('/trip-complete', authenticate, authorizeDriver, markTripComplete);

// Passenger
router.get('/:bus_id/location', authenticate, getBusLocation);

export default router;