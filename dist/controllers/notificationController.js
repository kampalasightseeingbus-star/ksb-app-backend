"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotifications = void 0;
const database_1 = __importDefault(require("../config/database"));
const getNotifications = async (req, res) => {
    const userId = req.user?.id;
    try {
        const result = await database_1.default.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        return res.json({ notifications: result.rows });
    }
    catch (err) {
        console.error('Get notifications error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
exports.getNotifications = getNotifications;
