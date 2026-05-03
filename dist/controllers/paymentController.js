"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyPayments = exports.pesapalCallback = exports.pesapalIPN = exports.verifyPayment = exports.initiatePayment = void 0;
const database_1 = __importDefault(require("../config/database"));
const pesapal_1 = require("../services/pesapal");
const pushNotification_1 = require("../services/pushNotification");
// ─────────────────────────────────────────────────────────────────
// INITIATE PAYMENT
// Called from booking screen after user selects payment method
// Creates booking, then sends to Pesapal for payment
// ─────────────────────────────────────────────────────────────────
const initiatePayment = async (req, res) => {
    const { schedule_id, seat_number, payment_method, currency, passengers, } = req.body;
    const user_id = req.user?.id;
    try {
        // Get user details
        const userResult = await database_1.default.query('SELECT full_name, phone, email FROM users WHERE id = $1', [user_id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = userResult.rows[0];
        // Check seat availability
        const seatCheck = await database_1.default.query(`SELECT id FROM bookings
       WHERE schedule_id = $1 AND seat_number = $2 AND status = 'confirmed'`, [schedule_id, seat_number]);
        if (seatCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Seat already taken. Please choose another.' });
        }
        // Get schedule and route details
        const scheduleResult = await database_1.default.query(`SELECT r.price_ugx, r.name AS route_name,
       s.departure_time, b.plate_number
       FROM schedules s
       JOIN routes r ON s.route_id = r.id
       JOIN buses b ON s.bus_id = b.id
       WHERE s.id = $1`, [schedule_id]);
        if (scheduleResult.rows.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        const schedule = scheduleResult.rows[0];
        const numPassengers = parseInt(passengers) || 1;
        // Calculate amount based on currency
        let amount;
        let paymentCurrency;
        if (currency === 'USD') {
            amount = 35 * numPassengers;
            paymentCurrency = 'USD';
        }
        else {
            amount = schedule.price_ugx * numPassengers;
            paymentCurrency = 'UGX';
        }
        // Generate QR code
        const qr_code = require('crypto').randomBytes(20).toString('hex');
        // Create booking with pending payment status
        const bookingResult = await database_1.default.query(`INSERT INTO bookings
       (user_id, schedule_id, seat_number, total_amount, payment_method, payment_status, qr_code)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`, [user_id, schedule_id, seat_number, amount, payment_method, qr_code]);
        const booking = bookingResult.rows[0];
        // Create payment record
        await database_1.default.query(`INSERT INTO payments (booking_id, user_id, amount, currency, method, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')`, [booking.id, user_id, amount, paymentCurrency, payment_method]);
        // Submit to Pesapal
        const pesapalOrder = await (0, pesapal_1.submitOrder)(booking.id, amount, paymentCurrency, user.full_name, user.phone, user.email || `${user.phone}@ksb.ug`, `${schedule.route_name} - Seat #${seat_number}`);
        // Save Pesapal tracking ID
        await database_1.default.query(`UPDATE payments SET provider_ref = $1 WHERE booking_id = $2`, [pesapalOrder.order_tracking_id, booking.id]);
        return res.status(201).json({
            message: 'Payment initiated',
            booking_id: booking.id,
            order_tracking_id: pesapalOrder.order_tracking_id,
            redirect_url: pesapalOrder.redirect_url,
            amount,
            currency: paymentCurrency,
        });
    }
    catch (err) {
        console.error('Initiate payment error:', err);
        return res.status(500).json({ message: err.message || 'Payment failed' });
    }
};
exports.initiatePayment = initiatePayment;
// ─────────────────────────────────────────────────────────────────
// VERIFY PAYMENT
// Called after user returns from Pesapal payment page
// Checks if payment was successful
// ─────────────────────────────────────────────────────────────────
const verifyPayment = async (req, res) => {
    const { order_tracking_id, booking_id } = req.body;
    try {
        // Check status with Pesapal
        const status = await (0, pesapal_1.getTransactionStatus)(order_tracking_id);
        if (status.status === 'Completed') {
            // Payment successful - update booking and payment
            await database_1.default.query(`UPDATE bookings SET payment_status = 'paid', status = 'confirmed'
         WHERE id = $1`, [booking_id]);
            await database_1.default.query(`UPDATE payments SET status = 'success' WHERE booking_id = $1`, [booking_id]);
            // Get booking details for notification
            const bookingResult = await database_1.default.query(`SELECT b.*, r.name AS route_name, s.departure_time, u.full_name
         FROM bookings b
         JOIN schedules s ON b.schedule_id = s.id
         JOIN routes r ON s.route_id = r.id
         JOIN users u ON b.user_id = u.id
         WHERE b.id = $1`, [booking_id]);
            if (bookingResult.rows.length > 0) {
                const booking = bookingResult.rows[0];
                const bookingRef = `KSB-${String(booking.id).padStart(6, '0')}`;
                // Send confirmation notification
                try {
                    await (0, pushNotification_1.notifyBookingConfirmed)(booking.user_id, bookingRef, booking.route_name, booking.departure_time, booking.seat_number);
                }
                catch (notifErr) {
                    console.log('Notification failed but payment confirmed');
                }
            }
            return res.json({
                message: 'Payment confirmed',
                status: 'paid',
                booking_id,
            });
        }
        else if (status.status === 'Failed') {
            await database_1.default.query(`UPDATE bookings SET payment_status = 'failed' WHERE id = $1`, [booking_id]);
            await database_1.default.query(`UPDATE payments SET status = 'failed' WHERE booking_id = $1`, [booking_id]);
            return res.json({ message: 'Payment failed', status: 'failed' });
        }
        else {
            return res.json({ message: 'Payment pending', status: 'pending' });
        }
    }
    catch (err) {
        console.error('Verify payment error:', err);
        return res.status(500).json({ message: err.message || 'Could not verify payment' });
    }
};
exports.verifyPayment = verifyPayment;
// ─────────────────────────────────────────────────────────────────
// PESAPAL IPN WEBHOOK
// Pesapal automatically calls this when payment status changes
// This is the most reliable way to confirm payments
// ─────────────────────────────────────────────────────────────────
const pesapalIPN = async (req, res) => {
    try {
        const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.body;
        console.log('Pesapal IPN received:', req.body);
        if (OrderNotificationType === 'IPNCHANGE') {
            // Check actual status
            const status = await (0, pesapal_1.getTransactionStatus)(OrderTrackingId);
            if (status.status === 'Completed') {
                // Extract booking ID from merchant reference KSB-000001-timestamp
                const bookingIdStr = OrderMerchantReference?.split('-')[1];
                const bookingId = parseInt(bookingIdStr);
                if (bookingId) {
                    await database_1.default.query(`UPDATE bookings SET payment_status = 'paid', status = 'confirmed'
             WHERE id = $1`, [bookingId]);
                    await database_1.default.query(`UPDATE payments SET status = 'success', provider_ref = $1
             WHERE booking_id = $2`, [OrderTrackingId, bookingId]);
                    console.log(`✅ Payment confirmed for booking ${bookingId}`);
                }
            }
        }
        // Always respond 200 to Pesapal
        return res.json({ status: 'OK', orderTrackingId: OrderTrackingId });
    }
    catch (err) {
        console.error('IPN error:', err);
        return res.status(200).json({ status: 'OK' });
    }
};
exports.pesapalIPN = pesapalIPN;
// ─────────────────────────────────────────────────────────────────
// CALLBACK
// User is redirected here after completing payment on Pesapal page
// ─────────────────────────────────────────────────────────────────
const pesapalCallback = async (req, res) => {
    const { OrderTrackingId, OrderMerchantReference } = req.query;
    try {
        const bookingIdStr = String(OrderMerchantReference).split('-')[1];
        const bookingId = parseInt(bookingIdStr);
        if (OrderTrackingId && bookingId) {
            const status = await (0, pesapal_1.getTransactionStatus)(String(OrderTrackingId));
            if (status.status === 'Completed') {
                await database_1.default.query(`UPDATE bookings SET payment_status = 'paid', status = 'confirmed'
           WHERE id = $1`, [bookingId]);
                await database_1.default.query(`UPDATE payments SET status = 'success' WHERE booking_id = $1`, [bookingId]);
            }
        }
        // Redirect user back to app
        return res.redirect(`ksb://receipt?bookingId=${bookingId}&status=success`);
    }
    catch (err) {
        console.error('Callback error:', err);
        return res.redirect(`ksb://receipt?status=failed`);
    }
};
exports.pesapalCallback = pesapalCallback;
// ─────────────────────────────────────────────────────────────────
// GET MY PAYMENTS
// ─────────────────────────────────────────────────────────────────
const getMyPayments = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT p.*, b.seat_number, r.name AS route_name
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN schedules s ON b.schedule_id = s.id
       JOIN routes r ON s.route_id = r.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`, [req.user?.id]);
        return res.json({ payments: result.rows });
    }
    catch (err) {
        console.error('Get payments error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getMyPayments = getMyPayments;
