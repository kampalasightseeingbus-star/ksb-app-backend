"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoute = exports.updateRoute = exports.createRoute = exports.getRouteSchedules = exports.getRouteById = exports.searchRoutes = exports.getAllRoutes = void 0;
const database_1 = __importDefault(require("../config/database"));
// ─── GET ALL ROUTES ───────────────────────────────────────────────
const getAllRoutes = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM routes ORDER BY created_at ASC');
        return res.json({ routes: result.rows });
    }
    catch (err) {
        console.error('Get routes error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getAllRoutes = getAllRoutes;
// ─── SEARCH ROUTES ────────────────────────────────────────────────
const searchRoutes = async (req, res) => {
    const { origin, destination } = req.query;
    try {
        const result = await database_1.default.query(`SELECT * FROM routes
       WHERE LOWER(origin) LIKE LOWER($1)
       AND LOWER(destination) LIKE LOWER($2)`, [`%${origin}%`, `%${destination}%`]);
        return res.json({ routes: result.rows });
    }
    catch (err) {
        console.error('Search routes error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.searchRoutes = searchRoutes;
// ─── GET SINGLE ROUTE ─────────────────────────────────────────────
const getRouteById = async (req, res) => {
    // ✅ FIX: Use type assertion to tell TypeScript this is a string
    const id = req.params.id;
    // Add ID validation
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) {
        return res.status(400).json({ message: 'Invalid route ID. Must be a number.' });
    }
    try {
        // Use routeId (number) instead of id (string)
        const result = await database_1.default.query('SELECT * FROM routes WHERE id = $1', [routeId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Route not found' });
        }
        return res.json({ route: result.rows[0] });
    }
    catch (err) {
        console.error('Get route error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getRouteById = getRouteById;
// ─── GET SCHEDULES FOR ROUTE ──────────────────────────────────────
const getRouteSchedules = async (req, res) => {
    // ✅ FIX: Use type assertion to tell TypeScript this is a string
    const id = req.params.id;
    // Add ID validation
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) {
        return res.status(400).json({ message: 'Invalid route ID. Must be a number.' });
    }
    try {
        const result = await database_1.default.query(`SELECT s.*, b.plate_number, b.model, b.total_seats,
       (b.total_seats - COUNT(bk.id)) AS available_seats
       FROM schedules s
       JOIN buses b ON s.bus_id = b.id
       LEFT JOIN bookings bk ON bk.schedule_id = s.id AND bk.status = 'confirmed'
       WHERE s.route_id = $1
       AND s.departure_time > NOW()
       AND s.status = 'scheduled'
       GROUP BY s.id, b.plate_number, b.model, b.total_seats
       ORDER BY s.departure_time ASC`, 
        // Use routeId (number) instead of id (string)
        [routeId]);
        return res.json({ schedules: result.rows });
    }
    catch (err) {
        console.error('Get schedules error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getRouteSchedules = getRouteSchedules;
// ─── CREATE ROUTE (Admin) ─────────────────────────────────────────
const createRoute = async (req, res) => {
    const { name, origin, destination, distance_km, duration_minutes, price_ugx } = req.body;
    try {
        const result = await database_1.default.query(`INSERT INTO routes (name, origin, destination, distance_km, duration_minutes, price_ugx)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [name, origin, destination, distance_km, duration_minutes, price_ugx]);
        return res.status(201).json({ message: 'Route created', route: result.rows[0] });
    }
    catch (err) {
        console.error('Create route error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.createRoute = createRoute;
// ─── UPDATE ROUTE (Admin) ─────────────────────────────────────────
const updateRoute = async (req, res) => {
    // ✅ FIX: Use type assertion to tell TypeScript this is a string
    const id = req.params.id;
    const { name, origin, destination, distance_km, duration_minutes, price_ugx } = req.body;
    // Add ID validation
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) {
        return res.status(400).json({ message: 'Invalid route ID. Must be a number.' });
    }
    try {
        const result = await database_1.default.query(`UPDATE routes SET name=$1, origin=$2, destination=$3,
       distance_km=$4, duration_minutes=$5, price_ugx=$6
       WHERE id=$7 RETURNING *`, 
        // Use routeId (number) for the ID parameter
        [name, origin, destination, distance_km, duration_minutes, price_ugx, routeId]);
        return res.json({ message: 'Route updated', route: result.rows[0] });
    }
    catch (err) {
        console.error('Update route error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.updateRoute = updateRoute;
// ─── DELETE ROUTE (Admin) ─────────────────────────────────────────
const deleteRoute = async (req, res) => {
    // ✅ FIX: Use type assertion to tell TypeScript this is a string
    const id = req.params.id;
    // Add ID validation
    const routeId = parseInt(id, 10);
    if (isNaN(routeId)) {
        return res.status(400).json({ message: 'Invalid route ID. Must be a number.' });
    }
    try {
        // Use routeId (number) instead of id (string)
        await database_1.default.query('DELETE FROM routes WHERE id = $1', [routeId]);
        return res.json({ message: 'Route deleted' });
    }
    catch (err) {
        console.error('Delete route error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteRoute = deleteRoute;
