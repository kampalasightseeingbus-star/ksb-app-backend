import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database';
import authRoutes from './routes/authRoutes';
import routeRoutes from './routes/routeRoutes';
import bookingRoutes from './routes/bookingRoutes';
import busRoutes from './routes/busRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import notificationRoutes from './routes/notificationRoutes';
import paymentRoutes from './routes/paymentRoutes';
/*import adminRoutes from './routes/adminRoutes';*/

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      message: '🚌 Kampala Sightseeing Bus API is running!',
      version: '1.0.0',
      status: 'OK',
      database: '✅ Connected',
      endpoints: {
        auth: '/api/auth',
        routes: '/api/routes',
        bookings: '/api/bookings',
        buses: '/api/buses',
        schedules: '/api/schedules',
        notifications: '/api/notifications',
        payments: '/api/payments',
        /*admin: '/api/admin',*/
      },
    });
  } catch (err) {
    res.json({
      message: '🚌 Kampala Sightseeing Bus API is running!',
      status: 'OK',
      database: '❌ Disconnected',
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments', paymentRoutes);
/*app.use('/api/admin', adminRoutes);*/

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

app.listen(PORT, () => {
  console.log(`🚌 KSB Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
});

// Stripe needs raw body for webhook signature verification
app.use('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }));

// All other routes use JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

export default app;