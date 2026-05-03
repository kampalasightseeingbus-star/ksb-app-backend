"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Registration flow
// Step 1: User submits name + phone → OTP sent
router.post('/register/send-otp', authController_1.sendOTP);
// Step 2: User enters OTP → account created + token returned
router.post('/register/verify-otp', authController_1.verifyOTPAndRegister);
// Login flow
// Step 1: User enters phone → OTP sent
router.post('/login/send-otp', authController_1.sendLoginOTP);
// Step 2: User enters OTP → token returned
router.post('/login/verify-otp', authController_1.verifyLoginOTP);
// Profile (protected - needs token)
router.get('/profile', auth_1.authenticate, authController_1.getProfile);
router.put('/profile', auth_1.authenticate, authController_1.updateProfile);
// Save device FCM token after login
router.post('/fcm-token', auth_1.authenticate, authController_1.saveFCMToken);
exports.default = router;
