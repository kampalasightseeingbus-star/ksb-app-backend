"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllBookings = exports.verifyQrCode = exports.getBookedSeats = exports.cancelBooking = exports.getBookingById = exports.getMyBookings = exports.createBooking = void 0;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../config/database"));
// ─── CREATE BOOKING ───────────────────────────────────────────────
const createBooking = async (req, res) => {
    const { schedule_id, seat_number, payment_method } = req.body;
    const user_id = req.user?.id;
    if (!schedule_id || !seat_number || !payment_method) {
        return res.status(400).json({
            message: 'Schedule, seat and payment method are required',
        });
    }
    try {
        // Check seat is not already taken
        const seatCheck = await database_1.default.query(`SELECT id FROM bookings
       WHERE schedule_id = $1 AND seat_number = $2 AND status = 'confirmed'`, [schedule_id, seat_number]);
        if (seatCheck.rows.length > 0) {
            return res.status(400).json({
                message: 'This seat is already booked. Please choose another.',
            });
        }
        // Get route price and schedule details
        const scheduleResult = await database_1.default.query(`SELECT r.price_ugx, r.name AS route_name, s.departure_time,
       b.plate_number, s.status
       FROM schedules s
       JOIN routes r ON s.route_id = r.id
       JOIN buses b ON s.bus_id = b.id
       WHERE s.id = $1`, [schedule_id]);
        if (scheduleResult.rows.length === 0) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        const schedule = scheduleResult.rows[0];
        if (schedule.status === 'cancelled') {
            return res.status(400).json({ message: 'This schedule has been cancelled' });
        }
        const total_amount = schedule.price_ugx;
        const qr_code = crypto_1.default.randomBytes(20).toString('hex');
        // Create the booking
        const result = await database_1.default.query(`INSERT INTO bookings
       (user_id, schedule_id, seat_number, total_amount, payment_method, payment_status, qr_code)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING *`, [user_id, schedule_id, seat_number, total_amount, payment_method, qr_code]);
        const booking = result.rows[0];
        const bookingRef = `KSB-${String(booking.id).padStart(6, '0')}`;
        // Update booking reference
        await database_1.default.query('UPDATE bookings SET booking_reference = $1 WHERE id = $2', [bookingRef, booking.id]);
        // Send booking confirmation push notification
        try {
            const pushModule = require('../services/pushNotification');
            if (pushModule && typeof pushModule.notifyBookingConfirmed === 'function') {
                await pushModule.notifyBookingConfirmed(user_id, bookingRef, schedule.route_name, schedule.departure_time, seat_number);
            }
            else {
                console.log('Push notification module not available, skipping');
            }
        }
        catch (notifErr) {
            console.error('Push notification failed:', notifErr);
            // Don't block booking creation if notification fails
        }
        return res.status(201).json({
            message: 'Booking created successfully',
            booking: { ...booking, booking_reference: bookingRef },
        });
    }
    catch (err) {
        console.error('Create booking error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.createBooking = createBooking;
// ─── GET MY BOOKINGS ──────────────────────────────────────────────
const getMyBookings = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT b.*, r.name AS route_name, r.origin, r.destination,
       s.departure_time, s.status AS schedule_status,
       bus.plate_number, bus.model
       FROM bookings b
       JOIN schedules s ON b.schedule_id = s.id
       JOIN routes r ON s.route_id = r.id
       JOIN buses bus ON s.bus_id = bus.id
       WHERE b.user_id = $1
       ORDER BY b.created_at DESC`, [req.user?.id]);
        return res.json({ bookings: result.rows });
    }
    catch (err) {
        console.error('Get bookings error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getMyBookings = getMyBookings;
// ─── GET SINGLE BOOKING ───────────────────────────────────────────
const getBookingById = async (req, res) => {
    const id = req.params.id;
    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId)) {
        return res.status(400).json({ message: 'Invalid booking ID' });
    }
    try {
        const result = await database_1.default.query(`SELECT b.*, r.name AS route_name, r.origin, r.destination,
       s.departure_time, s.arrival_time,
       bus.plate_number, bus.model, bus.id AS bus_id
       FROM bookings b
       JOIN schedules s ON b.schedule_id = s.id
       JOIN routes r ON s.route_id = r.id
       JOIN buses bus ON s.bus_id = bus.id
       WHERE b.id = $1 AND b.user_id = $2`, [bookingId, req.user?.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        return res.json({ booking: result.rows[0] });
    }
    catch (err) {
        console.error('Get booking error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getBookingById = getBookingById;
// ─── CANCEL BOOKING ───────────────────────────────────────────────
const cancelBooking = async (req, res) => {
    const id = req.params.id;
    const bookingId = parseInt(id, 10);
    if (isNaN(bookingId)) {
        return res.status(400).json({ message: 'Invalid booking ID' });
    }
    try {
        // Check if departure is more than 2 hours away
        const check = await database_1.default.query(`SELECT b.id, s.departure_time FROM bookings b
       JOIN schedules s ON b.schedule_id = s.id
       WHERE b.id = $1 AND b.user_id = $2 AND b.status = 'confirmed'`, [bookingId, req.user?.id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ message: 'Booking not found or already cancelled' });
        }
        const departure = new Date(check.rows[0].departure_time);
        const now = new Date();
        const hoursUntilDeparture = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursUntilDeparture < 2) {
            return res.status(400).json({
                message: 'Cancellation not allowed within 2 hours of departure',
            });
        }
        const result = await database_1.default.query(`UPDATE bookings SET status = 'cancelled'
       WHERE id = $1 AND user_id = $2
       RETURNING *`, [bookingId, req.user?.id]);
        return res.json({ message: 'Booking cancelled successfully', booking: result.rows[0] });
    }
    catch (err) {
        console.error('Cancel booking error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.cancelBooking = cancelBooking;
// ─── GET BOOKED SEATS ─────────────────────────────────────────────
const getBookedSeats = async (req, res) => {
    const id = req.params.schedule_id;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
        return res.status(400).json({ message: 'Invalid schedule ID' });
    }
    try {
        const result = await database_1.default.query(`SELECT seat_number FROM bookings
       WHERE schedule_id = $1 AND status = 'confirmed'`, [scheduleId]);
        return res.json({ booked_seats: result.rows.map((r) => r.seat_number) });
    }
    catch (err) {
        console.error('Get booked seats error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getBookedSeats = getBookedSeats;
// ─── VERIFY QR CODE (Driver) ──────────────────────────────────────
const verifyQrCode = async (req, res) => {
    const { qr_code } = req.body;
    try {
        const result = await database_1.default.query(`SELECT b.*, u.full_name, u.phone, r.name AS route_name,
       s.departure_time
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN schedules s ON b.schedule_id = s.id
       JOIN routes r ON s.route_id = r.id
       WHERE b.qr_code = $1`, [qr_code]);
        if (result.rows.length === 0) {
            return res.status(404).json({ valid: false, message: 'Invalid QR code' });
        }
        const booking = result.rows[0];
        if (booking.status !== 'confirmed') {
            return res.status(400).json({
                valid: false,
                message: `Ticket is ${booking.status}`,
            });
        }
        return res.json({ valid: true, booking });
    }
    catch (err) {
        console.error('Verify QR error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.verifyQrCode = verifyQrCode;
// ─── GET ALL BOOKINGS (Admin) ─────────────────────────────────────
const getAllBookings = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT b.*, u.full_name, u.phone,
       r.name AS route_name, s.departure_time
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN schedules s ON b.schedule_id = s.id
       JOIN routes r ON s.route_id = r.id
       ORDER BY b.created_at DESC`);
        return res.json({ bookings: result.rows });
    }
    catch (err) {
        console.error('Get all bookings error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getAllBookings = getAllBookings;
