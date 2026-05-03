"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookingController_1 = require("../controllers/bookingController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Passenger
router.post('/', auth_1.authenticate, bookingController_1.createBooking);
router.get('/my', auth_1.authenticate, bookingController_1.getMyBookings);
router.get('/seats/:schedule_id', bookingController_1.getBookedSeats);
router.get('/:id', auth_1.authenticate, bookingController_1.getBookingById);
router.put('/:id/cancel', auth_1.authenticate, bookingController_1.cancelBooking);
// Driver
router.post('/verify-qr', auth_1.authenticate, auth_1.authorizeDriver, bookingController_1.verifyQrCode);
// Admin
router.get('/', auth_1.authenticate, auth_1.authorizeAdmin, bookingController_1.getAllBookings);
exports.default = router;
