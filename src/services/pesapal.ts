import axios from 'axios';
import pool from '../config/database';

// Pesapal API URLs
const PESAPAL_BASE_URL = process.env.PESAPAL_ENV === 'live'
  ? 'https://pay.pesapal.com/v3'
  : 'https://pay.pesapal.com/v3';

// Store access token in memory
let accessToken: string | null = null;
let tokenExpiry: number = 0;

// ─────────────────────────────────────────────────────────────────
// STEP 1: GET ACCESS TOKEN
// Pesapal requires a token for every API call
// Token expires every 5 minutes so we refresh it automatically
// ─────────────────────────────────────────────────────────────────
export const getPesapalToken = async (): Promise<string> => {
  // Return cached token if still valid
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await axios.post(
      `${PESAPAL_BASE_URL}/api/Auth/RequestToken`,
      {
        consumer_key: process.env.PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
        console.log('Pesapal submit order response:', JSON.stringify(response.data));

    if (response.data.status === '200') {
      accessToken = response.data.token;
      // Token valid for 5 minutes - refresh 30 seconds early
      tokenExpiry = Date.now() + (4.5 * 60 * 1000);
      console.log('✅ Pesapal token obtained');
      return accessToken!;
    }

    throw new Error('Failed to get Pesapal token');
  } catch (err: any) {
    console.error('Pesapal token error:', err.response?.data || err.message);
    throw new Error('Could not connect to Pesapal');
  }
};

// ─────────────────────────────────────────────────────────────────
// STEP 2: REGISTER IPN URL
// IPN = Instant Payment Notification
// Pesapal calls this URL when a payment is completed
// Must be registered once with Pesapal
// ─────────────────────────────────────────────────────────────────
export const registerIPN = async (): Promise<string> => {
  try {
    const token = await getPesapalToken();

    const response = await axios.post(
      `${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`,
      {
        url: process.env.PESAPAL_IPN_URL,
        ipn_notification_type: 'POST',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.status === '200') {
      console.log('✅ Pesapal IPN registered:', response.data.ipn_id);
      return response.data.ipn_id;
    }

    throw new Error('Failed to register IPN');
  } catch (err: any) {
    console.error('Register IPN error:', err.response?.data || err.message);
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────
// STEP 3: SUBMIT ORDER
// Creates a payment order on Pesapal
// Returns a redirect URL where user completes payment
// ─────────────────────────────────────────────────────────────────
export const submitOrder = async (
  bookingId: number,
  amount: number,
  currency: string,
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  description: string
): Promise<{ order_tracking_id: string; redirect_url: string }> => {
  try {
    const token = await getPesapalToken();
    console.log('✅ Got token for submit order');

    // Get or register IPN
    let ipnId = process.env.PESAPAL_IPN_ID;
    if (!ipnId) {
      ipnId = await registerIPN();
      process.env.PESAPAL_IPN_ID = ipnId;
    }
    console.log('✅ Using IPN ID:', ipnId);
    const merchantReference = `KSB-${String(bookingId).padStart(6, '0')}-${Date.now()}`;

    const orderData = {
      id: merchantReference,
      currency: currency || 'UGX',
      amount: amount,
      description: description,
      callback_url: process.env.PESAPAL_CALLBACK_URL,
      notification_id: ipnId,
      billing_address: {
        first_name: customerName.split(' ')[0],
        last_name: customerName.split(' ').slice(1).join(' ') || customerName,
        phone_number: customerPhone,
        email_address: customerEmail || `${customerPhone}@ksb.ug`,
        country_code: 'UG',
      },
    };
    console.log('📤 Submitting order to Pesapal:', JSON.stringify(orderData));

        let response;
    try {
      response = await axios.post(
        `${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );
      console.log('📥 Pesapal response:', response.status, JSON.stringify(response.data));
    } catch (axiosErr: any) {
      console.error('❌ Axios error:', {
        message: axiosErr.message,
        code: axiosErr.code,
        status: axiosErr.response?.status,
        data: axiosErr.response?.data,
      });
      throw new Error(axiosErr.response?.data?.message || axiosErr.message || 'Failed to submit order');
    }

    if (response.data.status === '200') {
      console.log('✅ Pesapal order submitted:', response.data.order_tracking_id);
      return {
        order_tracking_id: response.data.order_tracking_id,
        redirect_url: response.data.redirect_url,
      };
    }

    throw new Error(response.data.message || 'Failed to submit order');
    } catch (err: any) {
    console.error('Submit order error:', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
    throw new Error(err.response?.data?.message || err.message || 'Payment initialization failed');
  }
};

// ─────────────────────────────────────────────────────────────────
// STEP 4: CHECK TRANSACTION STATUS
// Check if a payment was completed
// Call this after user returns from Pesapal payment page
// ─────────────────────────────────────────────────────────────────
export const getTransactionStatus = async (
  orderTrackingId: string
): Promise<{
  status: string;
  payment_method: string;
  amount: number;
  currency: string;
}> => {
  try {
    const token = await getPesapalToken();

    const response = await axios.get(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      status: response.data.payment_status_description,
      payment_method: response.data.payment_method,
      amount: response.data.amount,
      currency: response.data.currency,
    };
  } catch (err: any) {
    console.error('Get transaction status error:', err.response?.data || err.message);
    throw new Error('Could not verify payment');
  }
};