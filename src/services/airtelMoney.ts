import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const {
  AIRTEL_CLIENT_ID,
  AIRTEL_CLIENT_SECRET,
  AIRTEL_BASE_URL,
} = process.env;

// ─────────────────────────────────────────────────────────────────
// GET AIRTEL ACCESS TOKEN
// ─────────────────────────────────────────────────────────────────
let airtelToken: string | null = null;
let airtelTokenExpiry: number = 0;

const getAirtelToken = async (): Promise<string> => {
  if (airtelToken && Date.now() < airtelTokenExpiry) {
    return airtelToken;
  }

  const response = await axios.post(
    `${AIRTEL_BASE_URL}/auth/oauth2/token`,
    {
      client_id: AIRTEL_CLIENT_ID,
      client_secret: AIRTEL_CLIENT_SECRET,
      grant_type: 'client_credentials',
    },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  airtelToken = response.data.access_token;
  airtelTokenExpiry = Date.now() + 55 * 60 * 1000;
  return airtelToken!;
};

// ─────────────────────────────────────────────────────────────────
// REQUEST AIRTEL PAYMENT
// Sends payment request to customer's Airtel number
// Customer approves on their phone
// ─────────────────────────────────────────────────────────────────
export const requestAirtelPayment = async (
  phoneNumber: string,
  amount: number,
  bookingRef: string
): Promise<string> => {
  const token = await getAirtelToken();
  const transactionId = uuidv4();

  // Format phone for Uganda
  const formattedPhone = phoneNumber.startsWith('256')
    ? phoneNumber
    : phoneNumber.startsWith('0')
    ? `256${phoneNumber.slice(1)}`
    : phoneNumber.startsWith('+256')
    ? phoneNumber.slice(1)
    : `256${phoneNumber}`;

  await axios.post(
    `${AIRTEL_BASE_URL}/merchant/v1/payments/`,
    {
      reference: bookingRef,
      subscriber: {
        country: 'UG',
        currency: 'UGX',
        msisdn: formattedPhone,
      },
      transaction: {
        amount: String(amount),
        country: 'UG',
        currency: 'UGX',
        id: transactionId,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Country': 'UG',
        'X-Currency': 'UGX',
      },
    }
  );

  console.log(`✅ Airtel payment request sent. Transaction: ${transactionId}`);
  return transactionId;
};

// ─────────────────────────────────────────────────────────────────
// CHECK AIRTEL PAYMENT STATUS
// ─────────────────────────────────────────────────────────────────
export const checkAirtelPaymentStatus = async (
  transactionId: string
): Promise<{ status: string }> => {
  try {
    const token = await getAirtelToken();

    const response = await axios.get(
      `${AIRTEL_BASE_URL}/standard/v1/payments/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Country': 'UG',
          'X-Currency': 'UGX',
        },
      }
    );

    const statusCode = response.data?.data?.transaction?.status;
    return {
      status: statusCode === 'TS' ? 'SUCCESSFUL'
        : statusCode === 'TF' ? 'FAILED'
        : 'PENDING',
    };
  } catch (err: any) {
    console.error('Airtel status check error:', err.response?.data || err.message);
    return { status: 'FAILED' };
  }
};