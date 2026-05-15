import { Router, Request, Response } from 'express';
import {
  initiatePayment,
  checkPaymentStatus,
  stripeWebhook,
  getMyPayments,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Stripe webhook - must use raw body
router.post(
  '/webhook/stripe',
  (req: Request, res: Response, next: any) => {
    if (req.headers['stripe-signature']) {
      next();
    } else {
      next();
    }
  },
  stripeWebhook
);

// Passenger routes
router.post('/initiate', authenticate, initiatePayment);
router.get('/status/:booking_id', authenticate, checkPaymentStatus);
router.get('/my', authenticate, getMyPayments);

export default router;