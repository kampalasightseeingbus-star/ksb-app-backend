import { Router } from 'express';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getBookedSeats,
  verifyQrCode,
  getAllBookings,
} from '../controllers/bookingController';
import { authenticate, authorizeAdmin, authorizeDriver } from '../middleware/auth';

const router = Router();

// Passenger
router.post('/', authenticate, createBooking);
router.get('/my', authenticate, getMyBookings);
router.get('/seats/:schedule_id', getBookedSeats);
router.get('/:id', authenticate, getBookingById);
router.put('/:id/cancel', authenticate, cancelBooking);

// Driver
router.post('/verify-qr', authenticate, authorizeDriver, verifyQrCode);

// Admin
router.get('/', authenticate, authorizeAdmin, getAllBookings);

export default router;
