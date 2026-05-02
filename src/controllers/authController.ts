import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

// ─── TEMPORARY OTP STORE ──────────────────────────────────────────
// Stores OTPs in memory while user is verifying
// Key is phone number, value is OTP and expiry time
const otpStore: Record<string, { otp: string; expires: number; userData: any }> = {};

// ─── SEND OTP ─────────────────────────────────────────────────────
// Called when user submits registration form
// Generates OTP, stores user data temporarily, sends SMS
export const sendOTP = async (req: Request, res: Response): Promise<any> => {
  const { first_name, last_name, phone } = req.body;

  // Validate inputs
  if (!first_name || !last_name || !phone) {
    return res.status(400).json({
      message: 'First name, last name and phone number are required',
    });
  }

  try {
    // Check if phone is already registered
    const existing = await pool.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        message: 'This phone number is already registered. Please log in.',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000; // Expires in 5 minutes

    // Store OTP and user data temporarily until verified
    otpStore[phone] = {
      otp,
      expires,
      userData: { first_name, last_name, phone },
    };

    // Format phone for Uganda (+256)
    const formattedPhone = phone.startsWith('+')
      ? phone
      : phone.startsWith('0')
      ? `+256${phone.slice(1)}`
      : `+256${phone}`;

    // Send SMS via Africa's Talking
    try {
      const AfricasTalking = require('africastalking');
      const at = AfricasTalking({
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME,
      });

      await at.SMS.send({
        to: [formattedPhone],
        message: `Your Kampala Sightseeing Bus verification code is: ${otp}\n\nValid for 5 minutes. Do not share this code.`,
        from: 'KSB',
      });

      console.log(`✅ OTP sent to ${formattedPhone}`);
    } catch (smsErr) {
      // SMS failed but don't block the flow in development
      console.error('SMS send failed:', smsErr);
      console.log(`🔐 DEV OTP for ${phone}: ${otp}`);
    }

    return res.json({
      message: 'OTP sent successfully',
      // Only show OTP in development for testing
      ...(process.env.NODE_ENV !== 'production' && { debug_otp: otp }),
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── VERIFY OTP & CREATE ACCOUNT ─────────────────────────────────
// Called when user enters the OTP
// Verifies OTP, creates account, returns token
export const verifyOTPAndRegister = async (req: Request, res: Response): Promise<any> => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: 'Phone and OTP are required' });
  }

  const stored = otpStore[phone];

  // Check if OTP exists for this phone
  if (!stored) {
    return res.status(400).json({
      message: 'No OTP found for this number. Please register again.',
    });
  }

  // Check if OTP has expired
  if (Date.now() > stored.expires) {
    delete otpStore[phone];
    return res.status(400).json({
      message: 'OTP has expired. Please register again.',
    });
  }

  // Check if OTP is correct
  if (stored.otp !== otp.toString()) {
    return res.status(400).json({
      message: 'Incorrect OTP. Please try again.',
    });
  }

  try {
    const { first_name, last_name, phone: userPhone } = stored.userData;
    const full_name = `${first_name} ${last_name}`;

    // Create user account in database
    const result = await pool.query(
      `INSERT INTO users (full_name, phone, role)
       VALUES ($1, $2, 'passenger')
       RETURNING id, full_name, phone, role`,
      [full_name, userPhone]
    );

    const user = result.rows[0];

    // Clear OTP from store
    delete otpStore[phone];

    // Generate JWT token for the user
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    // Send welcome notification
    await pool.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)`,
      [
        user.id,
        'Welcome to KSB! 🚌',
        `Welcome ${first_name}! Your account is ready. Book your first Kampala Sightseeing Tour today.`,
      ]
    );

    return res.status(201).json({
      message: 'Account created successfully',
      token,
      user,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── SEND LOGIN OTP ───────────────────────────────────────────────
// For returning users - sends OTP to log back in
export const sendLoginOTP = async (req: Request, res: Response): Promise<any> => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    // Check if user exists
    const result = await pool.query(
      'SELECT id, full_name, phone FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'No account found with this number. Please register.',
      });
    }

    const user = result.rows[0];

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000;

    otpStore[phone] = { otp, expires, userData: user };

    // Format phone
    const formattedPhone = phone.startsWith('+')
      ? phone
      : phone.startsWith('0')
      ? `+256${phone.slice(1)}`
      : `+256${phone}`;

    // Send SMS
    try {
      const AfricasTalking = require('africastalking');
      const at = AfricasTalking({
        apiKey: process.env.AT_API_KEY,
        username: process.env.AT_USERNAME,
      });

      await at.SMS.send({
        to: [formattedPhone],
        message: `Your Kampala Sightseeing Bus login code is: ${otp}\n\nValid for 5 minutes. Do not share this code.`,
        from: 'KSB',
      });

      console.log(`✅ Login OTP sent to ${formattedPhone}`);
    } catch (smsErr) {
      console.error('SMS send failed:', smsErr);
      console.log(`🔐 DEV Login OTP for ${phone}: ${otp}`);
    }

    return res.json({
      message: 'OTP sent to your phone',
      ...(process.env.NODE_ENV !== 'production' && { debug_otp: otp }),
    });
  } catch (err) {
    console.error('Send login OTP error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── VERIFY LOGIN OTP ─────────────────────────────────────────────
// Verifies OTP and logs user in
export const verifyLoginOTP = async (req: Request, res: Response): Promise<any> => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: 'Phone and OTP are required' });
  }

  const stored = otpStore[phone];

  if (!stored) {
    return res.status(400).json({
      message: 'No OTP found. Please request a new one.',
    });
  }

  if (Date.now() > stored.expires) {
    delete otpStore[phone];
    return res.status(400).json({
      message: 'OTP expired. Please request a new one.',
    });
  }

  if (stored.otp !== otp.toString()) {
    return res.status(400).json({ message: 'Incorrect OTP. Please try again.' });
  }

  try {
    // Get full user from database
    const result = await pool.query(
      'SELECT id, full_name, phone, role FROM users WHERE phone = $1',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    delete otpStore[phone];

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '30d' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user,
    });
  } catch (err) {
    console.error('Verify login OTP error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── GET PROFILE ──────────────────────────────────────────────────
export const getProfile = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, phone, email, role, created_at FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────
export const updateProfile = async (req: AuthRequest, res: Response): Promise<any> => {
  const { full_name, email } = req.body;

  if (!full_name) {
    return res.status(400).json({ message: 'Full name is required' });
  }

  try {
    const result = await pool.query(
      `UPDATE users SET full_name = $1, email = $2
       WHERE id = $3
       RETURNING id, full_name, phone, email, role`,
      [full_name, email || null, req.user?.id]
    );

    return res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
// ─── SAVE FCM TOKEN ───────────────────────────────────────────────
// Called when app starts to save user's device push token
export const saveFCMToken = async (req: AuthRequest, res: Response): Promise<any> => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'FCM token is required' });
  }

  try {
    await pool.query(
      'UPDATE users SET fcm_token = $1 WHERE id = $2',
      [token, req.user?.id]
    );
    return res.json({ message: 'FCM token saved' });
  } catch (err) {
    console.error('Save FCM token error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};