"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markTripComplete = exports.markArrivedAtStop = exports.markApproachingStop = exports.getPassengerManifest = exports.getDriverSchedule = exports.getBusLocation = exports.updateBusLocation = exports.updateBus = exports.createBus = exports.getAllBuses = void 0;
const database_1 = __importDefault(require("../config/database"));
// ─── GET ALL BUSES (Admin) ────────────────────────────────────────
const getAllBuses = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT b.*, u.full_name AS driver_name, r.name AS route_name
       FROM buses b
       LEFT JOIN users u ON b.driver_id = u.id
       LEFT JOIN routes r ON b.route_id = r.id
       ORDER BY b.created_at DESC`);
        return res.json({ buses: result.rows });
    }
    catch (err) {
        console.error('Get buses error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getAllBuses = getAllBuses;
// ─── CREATE BUS (Admin) ───────────────────────────────────────────
const createBus = async (req, res) => {
    const { plate_number, model, total_seats, driver_id, route_id } = req.body;
    try {
        const result = await database_1.default.query(`INSERT INTO buses (plate_number, model, total_seats, driver_id, route_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`, [plate_number, model, total_seats, driver_id, route_id]);
        return res.status(201).json({ message: 'Bus created', bus: result.rows[0] });
    }
    catch (err) {
        console.error('Create bus error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.createBus = createBus;
// ─── UPDATE BUS (Admin) ───────────────────────────────────────────
const updateBus = async (req, res) => {
    const { id } = req.params;
    const { plate_number, model, total_seats, driver_id, route_id } = req.body;
    try {
        const result = await database_1.default.query(`UPDATE buses SET plate_number=$1, model=$2, total_seats=$3,
       driver_id=$4, route_id=$5 WHERE id=$6 RETURNING *`, [plate_number, model, total_seats, driver_id, route_id, id]);
        return res.json({ message: 'Bus updated', bus: result.rows[0] });
    }
    catch (err) {
        console.error('Update bus error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.updateBus = updateBus;
// ─── UPDATE BUS LOCATION (Driver) ────────────────────────────────
const updateBusLocation = async (req, res) => {
    const { bus_id, latitude, longitude } = req.body;
    try {
        await database_1.default.query(`INSERT INTO bus_locations (bus_id, latitude, longitude)
       VALUES ($1, $2, $3)`, [bus_id, latitude, longitude]);
        return res.json({ message: 'Location updated' });
    }
    catch (err) {
        console.error('Update location error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.updateBusLocation = updateBusLocation;
// ─── GET BUS LIVE LOCATION (Passenger) ───────────────────────────
const getBusLocation = async (req, res) => {
    const { bus_id } = req.params;
    try {
        const result = await database_1.default.query(`SELECT latitude, longitude, recorded_at
       FROM bus_locations
       WHERE bus_id = $1
       ORDER BY recorded_at DESC
       LIMIT 1`, [bus_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No location data found for this bus' });
        }
        return res.json({ location: result.rows[0] });
    }
    catch (err) {
        console.error('Get location error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getBusLocation = getBusLocation;
// ─── GET DRIVER SCHEDULE ─────────────────────────────────────────
const getDriverSchedule = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT s.*, r.name AS route_name, r.origin, r.destination,
       b.plate_number, b.model, b.total_seats, b.id AS bus_id,
       COUNT(bk.id) AS booked_seats
       FROM schedules s
       JOIN routes r ON s.route_id = r.id
       JOIN buses b ON s.bus_id = b.id
       LEFT JOIN bookings bk ON bk.schedule_id = s.id AND bk.status = 'confirmed'
       WHERE b.driver_id = $1
       AND s.departure_time > NOW() - INTERVAL '2 hours'
       GROUP BY s.id, r.name, r.origin, r.destination,
                b.plate_number, b.model, b.total_seats, b.id
       ORDER BY s.departure_time ASC`, [req.user?.id]);
        return res.json({ schedules: result.rows });
    }
    catch (err) {
        console.error('Get driver schedule error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getDriverSchedule = getDriverSchedule;
// ─── GET PASSENGER MANIFEST (Driver) ─────────────────────────────
const getPassengerManifest = async (req, res) => {
    const { schedule_id } = req.params;
    try {
        const result = await database_1.default.query(`SELECT b.id, b.seat_number, b.status, b.qr_code,
       u.full_name, u.phone
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.schedule_id = $1 AND b.status = 'confirmed'
       ORDER BY b.seat_number ASC`, [schedule_id]);
        return res.json({ passengers: result.rows });
    }
    catch (err) {
        console.error('Get manifest error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getPassengerManifest = getPassengerManifest;
// ─── DRIVER MARKS APPROACHING STOP ───────────────────────────────
// Driver taps "Approaching Stop" button in driver app
// Notifies all passengers booked for that stop
const markApproachingStop = async (req, res) => {
    const { schedule_id, stop_name, minutes_away, bus_plate } = req.body;
    try {
        // Get all confirmed passengers for this schedule
        const passengers = await database_1.default.query(`SELECT DISTINCT b.user_id
       FROM bookings b
       WHERE b.schedule_id = $1 AND b.status = 'confirmed'`, [schedule_id]);
        // Send notification to each passenger
        const { notifyBusApproaching } = require('../services/pushNotification');
        for (const passenger of passengers.rows) {
            await notifyBusApproaching(passenger.user_id, stop_name, minutes_away || 10, bus_plate);
        }
        return res.json({
            message: `Approaching notification sent to ${passengers.rows.length} passengers`,
        });
    }
    catch (err) {
        console.error('Mark approaching error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.markApproachingStop = markApproachingStop;
// ─── DRIVER MARKS ARRIVED AT STOP ────────────────────────────────
// Driver taps "Arrived at Stop" button in driver app
// Notifies all passengers for that stop to board now
const markArrivedAtStop = async (req, res) => {
    const { schedule_id, stop_name, bus_plate } = req.body;
    try {
        // Get all confirmed passengers for this schedule
        const passengers = await database_1.default.query(`SELECT DISTINCT b.user_id
       FROM bookings b
       WHERE b.schedule_id = $1 AND b.status = 'confirmed'`, [schedule_id]);
        // Send arrived notification to each passenger
        const { notifyBusArrived } = require('../services/pushNotification');
        for (const passenger of passengers.rows) {
            await notifyBusArrived(passenger.user_id, stop_name, bus_plate);
        }
        return res.json({
            message: `Arrival notification sent to ${passengers.rows.length} passengers`,
        });
    }
    catch (err) {
        console.error('Mark arrived error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.markArrivedAtStop = markArrivedAtStop;
// ─── DRIVER MARKS TRIP COMPLETE ───────────────────────────────────
const markTripComplete = async (req, res) => {
    const { schedule_id } = req.body;
    try {
        // Update schedule status
        await database_1.default.query(`UPDATE schedules SET status = 'completed' WHERE id = $1`, [schedule_id]);
        // Update all bookings for this schedule to completed
        await database_1.default.query(`UPDATE bookings SET status = 'completed'
       WHERE schedule_id = $1 AND status = 'confirmed'`, [schedule_id]);
        // Get route name and notify all passengers
        const result = await database_1.default.query(`SELECT b.user_id, r.name AS route_name
       FROM bookings b
       JOIN schedules s ON b.schedule_id = s.id
       JOIN routes r ON s.route_id = r.id
       WHERE b.schedule_id = $1`, [schedule_id]);
        const { notifyTripCompleted } = require('../services/pushNotification');
        for (const row of result.rows) {
            await notifyTripCompleted(row.user_id, row.route_name);
        }
        return res.json({ message: 'Trip marked as complete. Passengers notified.' });
    }
    catch (err) {
        console.error('Mark trip complete error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.markTripComplete = markTripComplete;
