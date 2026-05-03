"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSchedule = exports.updateScheduleStatus = exports.createSchedule = exports.getAllSchedules = void 0;
const database_1 = __importDefault(require("../config/database"));
// ─── GET ALL SCHEDULES (Admin) ────────────────────────────────────
const getAllSchedules = async (req, res) => {
    try {
        const result = await database_1.default.query(`SELECT s.*, r.name AS route_name, r.origin, r.destination,
       b.plate_number, b.model,
       COUNT(bk.id) AS booked_seats,
       b.total_seats
       FROM schedules s
       JOIN routes r ON s.route_id = r.id
       JOIN buses b ON s.bus_id = b.id
       LEFT JOIN bookings bk ON bk.schedule_id = s.id AND bk.status = 'confirmed'
       GROUP BY s.id, r.name, r.origin, r.destination, b.plate_number, b.model, b.total_seats
       ORDER BY s.departure_time DESC`);
        return res.json({ schedules: result.rows });
    }
    catch (err) {
        console.error('Get schedules error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getAllSchedules = getAllSchedules;
// ─── CREATE SCHEDULE (Admin) ──────────────────────────────────────
const createSchedule = async (req, res) => {
    const { route_id, bus_id, departure_time, arrival_time } = req.body;
    if (!route_id || !bus_id || !departure_time) {
        return res.status(400).json({ message: 'Route, bus and departure time are required' });
    }
    try {
        const result = await database_1.default.query(`INSERT INTO schedules (route_id, bus_id, departure_time, arrival_time, status)
       VALUES ($1, $2, $3, $4, 'scheduled') RETURNING *`, [route_id, bus_id, departure_time, arrival_time || null]);
        return res.status(201).json({ message: 'Schedule created', schedule: result.rows[0] });
    }
    catch (err) {
        console.error('Create schedule error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.createSchedule = createSchedule;
// ─── UPDATE SCHEDULE STATUS (Admin/Driver) ────────────────────────
const updateScheduleStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
    }
    try {
        const result = await database_1.default.query(`UPDATE schedules SET status = $1 WHERE id = $2 RETURNING *`, [status, id]);
        return res.json({ message: 'Schedule updated', schedule: result.rows[0] });
    }
    catch (err) {
        console.error('Update schedule error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.updateScheduleStatus = updateScheduleStatus;
// ─── DELETE SCHEDULE (Admin) ──────────────────────────────────────
const deleteSchedule = async (req, res) => {
    const { id } = req.params;
    try {
        await database_1.default.query('DELETE FROM schedules WHERE id = $1', [id]);
        return res.json({ message: 'Schedule deleted' });
    }
    catch (err) {
        console.error('Delete schedule error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.deleteSchedule = deleteSchedule;
