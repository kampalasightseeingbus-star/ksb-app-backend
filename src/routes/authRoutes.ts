import { Router } from 'express';
import {
  sendOTP,
  verifyOTPAndRegister,
  sendLoginOTP,
  verifyLoginOTP,
  getProfile,
  updateProfile,
  saveFCMToken,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Registration flow
// Step 1: User submits name + phone → OTP sent
router.post('/register/send-otp', sendOTP);
// Step 2: User enters OTP → account created + token returned
router.post('/register/verify-otp', verifyOTPAndRegister);

// Login flow
// Step 1: User enters phone → OTP sent
router.post('/login/send-otp', sendLoginOTP);
// Step 2: User enters OTP → token returned
router.post('/login/verify-otp', verifyLoginOTP);

// Profile (protected - needs token)
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

// Save device FCM token after login
router.post('/fcm-token', authenticate, saveFCMToken);

export default router;