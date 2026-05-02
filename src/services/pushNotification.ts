import admin from '../config/firebase';
import pool from '../config/database';

// ─────────────────────────────────────────────────────────────────
// SAVE FCM TOKEN
// When user opens app, their device token is saved here
// This token is used to send notifications to their specific phone
// ─────────────────────────────────────────────────────────────────
export const saveFCMToken = async (userId: number, token: string) => {
  try {
    await pool.query(
      `UPDATE users SET fcm_token = $1 WHERE id = $2`,
      [token, userId]
    );
  } catch (err) {
    console.error('Save FCM token error:', err);
  }
};

// ─────────────────────────────────────────────────────────────────
// SEND PUSH NOTIFICATION TO ONE USER
// Gets their FCM token from database and sends notification
// ─────────────────────────────────────────────────────────────────
export const sendPushToUser = async (
  userId: number,
  title: string,
  body: string,
  data?: Record<string, string>
) => {
  try {
    // Get user's FCM token from database
    const result = await pool.query(
      'SELECT fcm_token FROM users WHERE id = $1',
      [userId]
    );

    const fcmToken = result.rows[0]?.fcm_token;

    if (!fcmToken) {
      console.log(`No FCM token for user ${userId} - saving notification to DB only`);
      // Save to notifications table even if no FCM token
      await pool.query(
        `INSERT INTO notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [userId, title, body]
      );
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
          priority: 'high' as const,
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

    await admin.messaging().send(message);

    // Also save to notifications table in database
    await pool.query(
      `INSERT INTO notifications (user_id, title, message)
       VALUES ($1, $2, $3)`,
      [userId, title, body]
    );

    console.log(`✅ Push notification sent to user ${userId}: ${title}`);
  } catch (err) {
    console.error(`Push notification error for user ${userId}:`, err);
    // Still save to DB even if push fails
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message)
         VALUES ($1, $2, $3)`,
        [userId, title, body]
      );
    } catch (dbErr) {
      console.error('Failed to save notification to DB:', dbErr);
    }
  }
};

// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 1: BOOKING CONFIRMED
// Sent immediately when passenger completes booking
// ─────────────────────────────────────────────────────────────────
export const notifyBookingConfirmed = async (
  userId: number,
  bookingRef: string,
  routeName: string,
  departureTime: string,
  seatNumber: number
) => {
  const date = new Date(departureTime).toLocaleDateString('en-UG', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const time = new Date(departureTime).toLocaleTimeString('en-UG', {
    hour: '2-digit', minute: '2-digit',
  });

  await sendPushToUser(
    userId,
    '🎉 Booking Confirmed!',
    `Your ${routeName} is confirmed for ${date} at ${time}. Seat #${seatNumber}. Ref: ${bookingRef}`,
    {
      type: 'booking_confirmed',
      booking_ref: bookingRef,
    }
  );
};

// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 2: BUS APPROACHING PICKUP STOP
// Sent when driver is 10 minutes away from passenger's stop
// ─────────────────────────────────────────────────────────────────
export const notifyBusApproaching = async (
  userId: number,
  stopName: string,
  minutesAway: number,
  busPlate: string
) => {
  await sendPushToUser(
    userId,
    '🚌 Bus is Approaching!',
    `Your KSB bus (${busPlate}) is ${minutesAway} minutes away from ${stopName}. Please make your way to the stop.`,
    {
      type: 'bus_approaching',
      stop_name: stopName,
      minutes_away: String(minutesAway),
    }
  );
};

// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 3: BUS ARRIVED AT PICKUP STOP
// Sent when driver marks arrival at passenger's stop
// ─────────────────────────────────────────────────────────────────
export const notifyBusArrived = async (
  userId: number,
  stopName: string,
  busPlate: string
) => {
  await sendPushToUser(
    userId,
    '📍 Bus Has Arrived!',
    `Your KSB bus (${busPlate}) has arrived at ${stopName}. Please board now. Show your QR code to the driver.`,
    {
      type: 'bus_arrived',
      stop_name: stopName,
    }
  );
};

// ─────────────────────────────────────────────────────────────────
// NOTIFICATION 4: TRIP COMPLETED
// Sent when driver marks trip as complete
// ─────────────────────────────────────────────────────────────────
export const notifyTripCompleted = async (
  userId: number,
  routeName: string
) => {
  await sendPushToUser(
    userId,
    '✅ Trip Completed!',
    `Your ${routeName} has been completed. Thank you for riding with Kampala Sightseeing Bus! We hope you enjoyed the tour.`,
    { type: 'trip_completed' }
  );
};