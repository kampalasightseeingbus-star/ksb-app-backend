"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyTripCompleted = exports.notifyBusArrived = exports.notifyBusApproaching = exports.notifyBookingConfirmed = exports.sendPushToUser = exports.saveFCMToken = void 0;
const firebase_1 = __importDefault(require("../config/firebase"));
const database_1 = __importDefault(require("../config/database"));
// ─────────────────────────────────────────────────────────────────
// SAVE FCM TOKEN
// When user opens app, their device token is saved here
// This token is used to send notifications to their specific phone
// ─────────────────────────────────────────────────────────────────
const saveFCMToken = async (userId, token) => {
    try {
        await database_1.default.query(`UPDATE users SET fcm_token = $1 WHERE id = $2`, [token, userId]);
    }
    catch (err) {
        console.error('Save FCM token error:', err);
    }
};
exports.saveFCMToken = saveFCMToken;
// ─────────────────────────────────────────────────────────────────
// SEND PUSH NOTIFICATION TO ONE USER
// Gets their FCM token from database and sends notification
// ─────────────────────────────────────────────────────────────────
const sendPushToUser = async (userId, title, body, data) => {
    try {
        // Get user's FCM token from database
        const result = await database_1.default.query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
        const fcmToken = result.rows[0]?.fcm_token;
        if (!fcmToken) {
            console.log(`No FCM token for user ${userId} - saving notification to DB only`);
            // Save to notifications table even if no FCM token
            await database_1.default.query(`INSERT INTO notifications (user_id, title, message)
         VALUES ($1, $2, $3)`, [userId, title, body]);
            return;
        }
        // Send push notification via Firebase
        const message = {
            token: fcmToken,
            notification: { title, body },
            data: data || {},
            android: {
                notification: {
                    sound: 'default',
                    priority: 'high',
                    channelId: 'ksb_notifications',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
        };
        await firebase_1.default.messaging().send(message);
        // Also save to notifications table in database
        await database_1.default.query(`INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)`, [userId, title, body]);
        console.log(`✅ Push notification sent to user ${userId}: ${title}`);
    }
    catch (err) {
        console.error(`Push notification error for user ${userId}:`, err);
        // Still save to DB even if push fails
        try {
            await database_1.default.query(`INSERT INTO notifications (user_id, title, message)
         VALUES ($1, $2, $3)`, [userId, title, body]);
        }
        catch (dbErr) {
            console.error('Failed to save notification to DB:', dbErr);
        }
    }
};
exports.sendPushToUser = sendPushToUser;
// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 1: BOOKING CONFIRMED
// Sent immediately when passenger completes booking
// ─────────────────────────────────────────────────────────────────
const notifyBookingConfirmed = async (userId, bookingRef, routeName, departureTime, seatNumber) => {
    const date = new Date(departureTime).toLocaleDateString('en-UG', {
        weekday: 'short', day: 'numeric', month: 'short',
    });
    const time = new Date(departureTime).toLocaleTimeString('en-UG', {
        hour: '2-digit', minute: '2-digit',
    });
    await (0, exports.sendPushToUser)(userId, '🎉 Booking Confirmed!', `Your ${routeName} is confirmed for ${date} at ${time}. Seat #${seatNumber}. Ref: ${bookingRef}`, {
        type: 'booking_confirmed',
        booking_ref: bookingRef,
    });
};
exports.notifyBookingConfirmed = notifyBookingConfirmed;
// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 2: BUS APPROACHING PICKUP STOP
// Sent when driver is 10 minutes away from passenger's stop
// ─────────────────────────────────────────────────────────────────
const notifyBusApproaching = async (userId, stopName, minutesAway, busPlate) => {
    await (0, exports.sendPushToUser)(userId, '🚌 Bus is Approaching!', `Your KSB bus (${busPlate}) is ${minutesAway} minutes away from ${stopName}. Please make your way to the stop.`, {
        type: 'bus_approaching',
        stop_name: stopName,
        minutes_away: String(minutesAway),
    });
};
exports.notifyBusApproaching = notifyBusApproaching;
// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 3: BUS ARRIVED AT PICKUP STOP
// Sent when driver marks arrival at passenger's stop
// ─────────────────────────────────────────────────────────────────
const notifyBusArrived = async (userId, stopName, busPlate) => {
    await (0, exports.sendPushToUser)(userId, '📍 Bus Has Arrived!', `Your KSB bus (${busPlate}) has arrived at ${stopName}. Please board now. Show your QR code to the driver.`, {
        type: 'bus_arrived',
        stop_name: stopName,
    });
};
exports.notifyBusArrived = notifyBusArrived;
// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 4: TRIP COMPLETED
// Sent when driver marks trip as complete
// ─────────────────────────────────────────────────────────────────
const notifyTripCompleted = async (userId, routeName) => {
    await (0, exports.sendPushToUser)(userId, '✅ Trip Completed!', `Your ${routeName} has been completed. Thank you for riding with Kampala Sightseeing Bus! We hope you enjoyed the tour.`, { type: 'trip_completed' });
};
exports.notifyTripCompleted = notifyTripCompleted;
