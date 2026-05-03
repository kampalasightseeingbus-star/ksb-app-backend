"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("./config/database"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
// Routes
const routeRoutes_1 = __importDefault(require("./routes/routeRoutes"));
const bookingRoutes_1 = __importDefault(require("./routes/bookingRoutes"));
const busRoutes_1 = __importDefault(require("./routes/busRoutes"));
const scheduleRoutes_1 = __importDefault(require("./routes/scheduleRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
const corsOptions = {
    origin: '*', // Allow all origins (for development)
    methods: 'GET,POST,PUT,DELETE',
    credentials: true,
};
// ─── Middleware ───────────────────────────────────────────────────
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// ❌ REMOVE THESE - They're mounting routes without /api prefix
// app.use(routeRoutes);
// app.use(bookingRoutes);
// app.use(busRoutes);
// app.use(scheduleRoutes);
// app.use(authRoutes);
// ─── Health Check ─────────────────────────────────────────────────
app.get('/', async (req, res) => {
    try {
        await database_1.default.query('SELECT 1');
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
    }
    catch (err) {
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
app.use('/api/auth', authRoutes_1.default);
app.use('/api/routes', routeRoutes_1.default);
app.use('/api/bookings', bookingRoutes_1.default);
app.use('/api/buses', busRoutes_1.default);
app.use('/api/schedules', scheduleRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
// ─── 404 Handler ─────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});
// ─── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
});
// ─── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚌 KSB Server running on port ${PORT}`);
    console.log(`📡 API available at http://localhost:${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/`);
});
exports.default = app;
