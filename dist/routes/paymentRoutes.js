"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentController_1 = require("../controllers/paymentController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Pesapal webhooks - no auth needed
router.post('/pesapal/ipn', paymentController_1.pesapalIPN);
router.get('/pesapal/callback', paymentController_1.pesapalCallback);
// Passenger routes
router.post('/initiate', auth_1.authenticate, paymentController_1.initiatePayment);
router.post('/verify', auth_1.authenticate, paymentController_1.verifyPayment);
router.get('/my', auth_1.authenticate, paymentController_1.getMyPayments);
exports.default = router;
