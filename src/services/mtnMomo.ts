import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const {
  MTN_SUBSCRIPTION_KEY,
  MTN_USER_ID,
  MTN_API_KEY,
  MTN_ENVIRONMENT,
  MTN_BASE_URL,
} = process.env;

// ─────────────────────────────────────────────────────────────────
// GET ACCESS TOKEN
// MTN requires a fresh token for every API session
// Token expires every 60 minutes
// ─────────────────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const getAccessToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const credentials = Buffer.from(
    `${MTN_USER_ID}:${MTN_API_KEY}`
  ).toString('base64');

  const response = await axios.post(
    `${MTN_BASE_URL}/collection/token/`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
      },
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // 55 minutes
  return cachedToken!;
};

// ─────────────────────────────────────────────────────────────────
// REQUEST TO PAY
// Sends a payment prompt to the customer's MTN phone
// Customer sees popup on phone and enters their PIN to approve
// Returns a referenceId to check status later
// ─────────────────────────────────────────────────────────────────
export const requestMTNPayment = async (
  phoneNumber: string,
  amount: number,
  bookingRef: string
): Promise<string> => {
  const token = await getAccessToken();
  const referenceId = uuidv4();

  // Format phone number for Uganda (+256)
  const formattedPhone = phoneNumber.startsWith('256')
    ? phoneNumber
    : phoneNumber.startsWith('0')
    ? `256${phoneNumber.slice(1)}`
    : phoneNumber.startsWith('+256')
    ? phoneNumber.slice(1)
    : `256${phoneNumber}`;

  await axios.post(
    `${MTN_BASE_URL}/collection/v1_0/requesttopay`,
    {
      amount: String(amount),
      currency: 'UGX',
      externalId: bookingRef,
      payer: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone,
      },
      payerMessage: `Payment for Kampala Sightseeing Bus - ${bookingRef}`,
      payeeNote: `KSB Booking ${bookingRef}`,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': MTN_ENVIRONMENT,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`✅ MTN payment request sent. Reference: ${referenceId}`);
  return referenceId;
};

// ─────────────────────────────────────────────────────────────────
// CHECK TRANSACTION STATUS
// Call this after customer has had time to approve
// Returns: SUCCESSFUL, FAILED, or PENDING
// ─────────────────────────────────────────────────────────────────
export const checkMTNPaymentStatus = async (
  referenceId: string
): Promise<{ status: string; reason?: string }> => {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `${MTN_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Target-Environment': MTN_ENVIRONMENT,
          'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
        },
      }
    );

    return {
      status: response.data.status, // SUCCESSFUL, FAILED, PENDING
      reason: response.data.reason,
    };
  } catch (err: any) {
    console.error('MTN status check error:', err.response?.data || err.message);
    return { status: 'FAILED', reason: 'Could not check status' };
  }
};