import { Router } from 'express';
import {
  initiatePayment,
  verifyPayment,
  pesapalIPN,
  pesapalCallback,
  getMyPayments,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Pesapal webhooks - no auth needed
router.post('/pesapal/ipn', pesapalIPN);
router.get('/pesapal/callback', pesapalCallback);

// Passenger routes
router.post('/initiate', authenticate, initiatePayment);
router.post('/verify', authenticate, verifyPayment);
router.get('/my', authenticate, getMyPayments);

export default router;