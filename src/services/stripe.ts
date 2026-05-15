import Stripe from 'stripe';
import dotenv from 'dotenv';
import StripeTypes from 'stripe';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
});
type PaymentIntent = Awaited<ReturnType<typeof stripe.paymentIntents.retrieve>>;

// ─────────────────────────────────────────────────────────────────
// CREATE PAYMENT INTENT
// Stripe creates a payment intent that the frontend uses
// to collect card details securely
// ─────────────────────────────────────────────────────────────────
export const createStripePaymentIntent = async (
  amount: number,
  currency: string,
  bookingRef: string,
  customerEmail?: string
): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  // Stripe uses smallest currency unit
  // For USD: amount in cents (35 USD = 3500 cents)
  // For UGX: amount as is (UGX doesn't use decimals)
  const stripeAmount = currency === 'USD'
    ? amount * 100
    : amount;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripeAmount,
    currency: currency.toLowerCase(),
    metadata: {
      booking_ref: bookingRef,
    },
    receipt_email: customerEmail,
    automatic_payment_methods: { enabled: true },
  });

  console.log(`✅ Stripe payment intent created: ${paymentIntent.id}`);

  return {
    clientSecret: paymentIntent.client_secret!,
    paymentIntentId: paymentIntent.id,
  };
};

// ─────────────────────────────────────────────────────────────────
// VERIFY STRIPE PAYMENT
// Check if a payment was successfully completed
// ─────────────────────────────────────────────────────────────────
export const verifyStripePayment = async (
  paymentIntentId: string
): Promise<{ status: string }> => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      status: paymentIntent.status === 'succeeded'
        ? 'SUCCESSFUL'
        : paymentIntent.status === 'canceled'
        ? 'FAILED'
        : 'PENDING',
    };
  } catch (err: any) {
    console.error('Stripe verify error:', err.message);
    return { status: 'FAILED' };
  }
};

// ─────────────────────────────────────────────────────────────────
// STRIPE WEBHOOK
// Stripe calls this automatically when payment completes
// ─────────────────────────────────────────────────────────────────
export const handleStripeWebhook = async (
  payload: Buffer,
  signature: string
): Promise<{ bookingRef: string; status: string } | null> => {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as PaymentIntent;
      return {
        bookingRef: paymentIntent.metadata.booking_ref,
        status: 'SUCCESSFUL',
      };
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as PaymentIntent;
      return {
        bookingRef: paymentIntent.metadata.booking_ref,
        status: 'FAILED',
      };
    }

    return null;
  } catch (err: any) {
    console.error('Stripe webhook error:', err.message);
    return null;
  }
};