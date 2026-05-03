"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionStatus = exports.submitOrder = exports.registerIPN = exports.getPesapalToken = void 0;
const axios_1 = __importDefault(require("axios"));
// Pesapal API URLs
const PESAPAL_BASE_URL = process.env.PESAPAL_ENV === 'live'
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3';
// Store access token in memory
let accessToken = null;
let tokenExpiry = 0;
// ─────────────────────────────────────────────────────────────────
// STEP 1: GET ACCESS TOKEN
// Pesapal requires a token for every API call
// Token expires every 5 minutes so we refresh it automatically
// ─────────────────────────────────────────────────────────────────
const getPesapalToken = async () => {
    // Return cached token if still valid
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }
    try {
        const response = await axios_1.default.post(`${PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
            consumer_key: process.env.PESAPAL_CONSUMER_KEY,
            consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
        }, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (response.data.status === '200') {
            accessToken = response.data.token;
            // Token valid for 5 minutes - refresh 30 seconds early
            tokenExpiry = Date.now() + (4.5 * 60 * 1000);
            console.log('✅ Pesapal token obtained');
            return accessToken;
        }
        throw new Error('Failed to get Pesapal token');
    }
    catch (err) {
        console.error('Pesapal token error:', err.response?.data || err.message);
        throw new Error('Could not connect to Pesapal');
    }
};
exports.getPesapalToken = getPesapalToken;
// ─────────────────────────────────────────────────────────────────
// STEP 2: REGISTER IPN URL
// IPN = Instant Payment Notification
// Pesapal calls this URL when a payment is completed
// Must be registered once with Pesapal
// ─────────────────────────────────────────────────────────────────
const registerIPN = async () => {
    try {
        const token = await (0, exports.getPesapalToken)();
        const response = await axios_1.default.post(`${PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
            url: process.env.PESAPAL_IPN_URL,
            ipn_notification_type: 'POST',
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (response.data.status === '200') {
            console.log('✅ Pesapal IPN registered:', response.data.ipn_id);
            return response.data.ipn_id;
        }
        throw new Error('Failed to register IPN');
    }
    catch (err) {
        console.error('Register IPN error:', err.response?.data || err.message);
        throw err;
    }
};
exports.registerIPN = registerIPN;
// ─────────────────────────────────────────────────────────────────
// STEP 3: SUBMIT ORDER
// Creates a payment order on Pesapal
// Returns a redirect URL where user completes payment
// ─────────────────────────────────────────────────────────────────
const submitOrder = async (bookingId, amount, currency, customerName, customerPhone, customerEmail, description) => {
    try {
        const token = await (0, exports.getPesapalToken)();
        // Get or register IPN
        let ipnId = process.env.PESAPAL_IPN_ID;
        if (!ipnId) {
            ipnId = await (0, exports.registerIPN)();
            process.env.PESAPAL_IPN_ID = ipnId;
        }
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
            },
        };
        const response = await axios_1.default.post(`${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, orderData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        if (response.data.status === '200') {
            console.log('✅ Pesapal order submitted:', response.data.order_tracking_id);
            return {
                order_tracking_id: response.data.order_tracking_id,
                redirect_url: response.data.redirect_url,
            };
        }
        throw new Error(response.data.message || 'Failed to submit order');
    }
    catch (err) {
        console.error('Submit order error:', err.response?.data || err.message);
        throw new Error(err.response?.data?.message || 'Payment initialization failed');
    }
};
exports.submitOrder = submitOrder;
// ─────────────────────────────────────────────────────────────────
// STEP 4: CHECK TRANSACTION STATUS
// Check if a payment was completed
// Call this after user returns from Pesapal payment page
// ─────────────────────────────────────────────────────────────────
const getTransactionStatus = async (orderTrackingId) => {
    try {
        const token = await (0, exports.getPesapalToken)();
        const response = await axios_1.default.get(`${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        return {
            status: response.data.payment_status_description,
            payment_method: response.data.payment_method,
            amount: response.data.amount,
            currency: response.data.currency,
        };
    }
    catch (err) {
        console.error('Get transaction status error:', err.response?.data || err.message);
        throw new Error('Could not verify payment');
    }
};
exports.getTransactionStatus = getTransactionStatus;
