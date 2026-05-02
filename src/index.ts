import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database';
import authRoutes from './routes/authRoutes';

// Routes
import routeRoutes from './routes/routeRoutes';
import bookingRoutes from './routes/bookingRoutes';
import busRoutes from './routes/busRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import { create } from 'domain';
import notificationRoutes from './routes/notificationRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const corsOptions = {
  origin: '*', // Allow all origins (for development)
  methods: 'GET,POST,PUT,DELETE',
  credentials: true,
};

// ─── Middleware ───────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ❌ REMOVE THESE - They're mounting routes without /api prefix
// app.use(routeRoutes);
// app.use(bookingRoutes);
// app.use(busRoutes);
// app.use(scheduleRoutes);
// app.use(authRoutes);

// ─── Health Check ─────────────────────────────────────────────────
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
      },
    });
  } catch (err) {
    res.json({
      message: '🚌 Kampala Sightseeing Bus API is running!',
      version: '1.0.0',
      status: 'OK',
      database: '❌ Disconnected - check your .env file',
    });
  }
});

// ─── API Routes ───────────────────────────────────────────────────
// ✅ KEEP ONLY THESE - With /api prefix
app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/notifications', notificationRoutes); 

// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚌 KSB Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/`);
});

export default app;