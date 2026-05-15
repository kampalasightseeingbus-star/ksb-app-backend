import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { requestMTNPayment, checkMTNPaymentStatus } from '../services/mtnMomo';
import { requestAirtelPayment, checkAirtelPaymentStatus } from '../services/airtelMoney';
import { createStripePaymentIntent, verifyStripePayment, handleStripeWebhook } from '../services/stripe';

// ─────────────────────────────────────────────────────────────────
// INITIATE PAYMENT
// Handles MTN, Airtel and Card payments
// ─────────────────────────────────────────────────────────────────
export const initiatePayment = async (req: AuthRequest, res: Response): Promise<any> => {
  const {
    schedule_id,
    seat_number,
    payment_method,
    currency,
    passengers,
    phone_number,
  } = req.body;

  const user_id = req.user?.id;

  if (!schedule_id || !seat_number || !payment_method) {
    return res.status(400).json({
      message: 'Schedule ID, seat number and payment method are required',
    });
  }

  try {
    // Get user details
    const userResult = await pool.query(
      'SELECT full_name, phone, email FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Check seat is available
    const seatCheck = await pool.query(
      `SELECT id FROM bookings
       WHERE schedule_id = $1 AND seat_number = $2 AND status = 'confirmed'`,
      [schedule_id, seat_number]
    );

    if (seatCheck.rows.length > 0) {
      return res.status(400).json({
        message: 'This seat is already booked. Please choose another seat.',
      });
    }

    // Get schedule and route details
    const scheduleResult = await pool.query(
      `SELECT r.price_ugx, r.name AS route_name, s.departure_time, b.plate_number
       FROM schedules s
       JOIN routes r ON s.route_id = r.id
       JOIN buses b ON s.bus_id = b.id
       WHERE s.id = $1`,
      [schedule_id]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    const schedule = scheduleResult.rows[0];
    const numPassengers = parseInt(passengers) || 1;

    // Calculate amount
    let amount: number;
    let paymentCurrency: string;

    if (currency === 'USD') {
      amount = 35 * numPassengers;
      paymentCurrency = 'USD';
    } else {
      amount = Number(schedule.price_ugx) * numPassengers;
      paymentCurrency = 'UGX';
    }

    // Generate QR code for ticket
    const qr_code = require('crypto').randomBytes(20).toString('hex');

    // Create booking with pending status
    const bookingResult = await pool.query(
      `INSERT INTO bookings
       (user_id, schedule_id, seat_number, total_amount, payment_method, payment_status, qr_code)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [user_id, schedule_id, seat_number, amount, payment_method, qr_code]
    );

    const booking = bookingResult.rows[0];
    const bookingRef = `KSB-${String(booking.id).padStart(6, '0')}`;

    // Handle each payment method
    let paymentData: any = {};

    if (payment_method === 'mtn_momo') {
      // MTN Mobile Money
      const mtnPhone = phone_number || user.phone;
      const referenceId = await requestMTNPayment(mtnPhone, amount, bookingRef);

      // Save reference ID to payments table
      await pool.query(
        `INSERT INTO payments (booking_id, user_id, amount, currency, method, status, provider_ref)
         VALUES ($1, $2, $3, $4, 'mtn_momo', 'pending', $5)`,
        [booking.id, user_id, amount, paymentCurrency, referenceId]
      );

      paymentData = {
        method: 'mtn_momo',
        reference_id: referenceId,
        message: 'A payment prompt has been sent to your MTN number. Please enter your PIN to approve.',
        phone: mtnPhone,
      };

    } else if (payment_method === 'airtel_money') {
      // Airtel Money
      const airtelPhone = phone_number || user.phone;
      const transactionId = await requestAirtelPayment(airtelPhone, amount, bookingRef);

      await pool.query(
        `INSERT INTO payments (booking_id, user_id, amount, currency, method, status, provider_ref)
         VALUES ($1, $2, $3, $4, 'airtel_money', 'pending', $5)`,
        [booking.id, user_id, amount, paymentCurrency, transactionId]
      );

      paymentData = {
        method: 'airtel_money',
        reference_id: transactionId,
        message: 'A payment prompt has been sent to your Airtel number. Please enter your PIN to approve.',
        phone: airtelPhone,
      };

    } else if (payment_method === 'card') {
      // Stripe Card Payment
      const { clientSecret, paymentIntentId } = await createStripePaymentIntent(
        amount,
        paymentCurrency,
        bookingRef,
        user.email
      );

      await pool.query(
        `INSERT INTO payments (booking_id, user_id, amount, currency, method, status, provider_ref)
         VALUES ($1, $2, $3, $4, 'card', 'pending', $5)`,
        [booking.id, user_id, amount, paymentCurrency, paymentIntentId]
      );

      paymentData = {
        method: 'card',
        client_secret: clientSecret,
        payment_intent_id: paymentIntentId,
        publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
        message: 'Use the client_secret to complete card payment on the frontend.',
      };
    } else {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    return res.status(201).json({
      message: 'Payment initiated successfully',
      booking_id: booking.id,
      booking_ref: bookingRef,
      amount,
      currency: paymentCurrency,
      ...paymentData,
    });

  } catch (err: any) {
    console.error('Initiate payment error:', err.response?.data || err.message);
    return res.status(500).json({
      message: err.message || 'Payment initiation failed',
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// CHECK PAYMENT STATUS
// Frontend polls this after sending payment request
// to find out if customer approved the payment
// ─────────────────────────────────────────────────────────────────
export const checkPaymentStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  const { booking_id } = req.params;

  try {
    // Get payment details
    const paymentResult = await pool.query(
      `SELECT p.*, b.status AS booking_status, b.user_id
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       WHERE p.booking_id = $1`,
      [booking_id]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];

    // Already confirmed - return success
    if (payment.status === 'success') {
      return res.json({ status: 'SUCCESSFUL', booking_id });
    }

    // Check status with provider
    let providerStatus: { status: string };

    if (payment.method === 'mtn_momo') {
      providerStatus = await checkMTNPaymentStatus(payment.provider_ref);
    } else if (payment.method === 'airtel_money') {
      providerStatus = await checkAirtelPaymentStatus(payment.provider_ref);
    } else if (payment.method === 'card') {
      providerStatus = await verifyStripePayment(payment.provider_ref);
    } else {
      return res.status(400).json({ message: 'Unknown payment method' });
    }

    // If payment succeeded update database
    if (providerStatus.status === 'SUCCESSFUL') {
      await pool.query(
        `UPDATE payments SET status = 'success' WHERE booking_id = $1`,
        [booking_id]
      );
      await pool.query(
        `UPDATE bookings SET payment_status = 'paid', status = 'confirmed' WHERE id = $1`,
        [booking_id]
      );

      // Send notification
      try {
        const { notifyBookingConfirmed } = require('../services/pushNotification');
        const bookingResult = await pool.query(
          `SELECT b.*, r.name AS route_name, s.departure_time
           FROM bookings b
           JOIN schedules s ON b.schedule_id = s.id
           JOIN routes r ON s.route_id = r.id
           WHERE b.id = $1`,
          [booking_id]
        );

        if (bookingResult.rows.length > 0) {
          const b = bookingResult.rows[0];
          const bookingRef = `KSB-${String(b.id).padStart(6, '0')}`;
          await notifyBookingConfirmed(
            b.user_id,
            bookingRef,
            b.route_name,
            b.departure_time,
            b.seat_number
          );
        }
      } catch (notifErr) {
        console.log('Notification failed but payment confirmed');
      }

      return res.json({
        status: 'SUCCESSFUL',
        booking_id,
        message: 'Payment confirmed! Your booking is confirmed.',
      });
    }

    if (providerStatus.status === 'FAILED') {
      await pool.query(
        `UPDATE payments SET status = 'failed' WHERE booking_id = $1`,
        [booking_id]
      );
      await pool.query(
        `UPDATE bookings SET payment_status = 'failed' WHERE id = $1`,
        [booking_id]
      );

      return res.json({
        status: 'FAILED',
        booking_id,
        message: 'Payment was declined or failed. Please try again.',
      });
    }

    // Still pending
    return res.json({
      status: 'PENDING',
      booking_id,
      message: 'Payment is still being processed. Please approve the prompt on your phone.',
    });

  } catch (err: any) {
    console.error('Check payment status error:', err.message);
    return res.status(500).json({ message: 'Could not check payment status' });
  }
};

// ─────────────────────────────────────────────────────────────────
// STRIPE WEBHOOK
// Stripe calls this when card payment completes
// ─────────────────────────────────────────────────────────────────
export const stripeWebhook = async (req: Request, res: Response): Promise<any> => {
  const signature = req.headers['stripe-signature'] as string;

  try {
    const result = await handleStripeWebhook(req.body, signature);

    if (result && result.status === 'SUCCESSFUL') {
      const bookingId = result.bookingRef.split('-')[1];

      await pool.query(
        `UPDATE payments SET status = 'success'
         WHERE provider_ref IN (
           SELECT provider_ref FROM payments p
           JOIN bookings b ON p.booking_id = b.id
           WHERE b.id = $1
         )`,
        [parseInt(bookingId)]
      );

      await pool.query(
        `UPDATE bookings SET payment_status = 'paid', status = 'confirmed'
         WHERE id = $1`,
        [parseInt(bookingId)]
      );
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return res.status(400).json({ message: 'Webhook error' });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET MY PAYMENTS
// ─────────────────────────────────────────────────────────────────
export const getMyPayments = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const result = await pool.query(
      `SELECT p.*, b.seat_number, r.name AS route_name, s.departure_time
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN schedules s ON b.schedule_id = s.id
       JOIN routes r ON s.route_id = r.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user?.id]
    );
    return res.json({ payments: result.rows });
  } catch (err) {
    console.error('Get payments error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};