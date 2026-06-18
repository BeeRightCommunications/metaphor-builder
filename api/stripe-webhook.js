import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log('Stripe webhook received:', event.type);

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;

        if (!userId || !plan) break;

        if (plan === 'lifetime') {
          // One-time payment — set lifetime access
          await supabase
            .from('profiles')
            .update({
              plan: 'lifetime',
              subscription_status: 'active',
              plan_expires_at: null,
              stripe_subscription_id: null,
            })
            .eq('id', userId);
        } else {
          // Subscription — store subscription ID
          const subscriptionId = session.subscription;
          await supabase
            .from('profiles')
            .update({
              plan,
              subscription_status: 'active',
              stripe_subscription_id: subscriptionId,
              plan_expires_at: null,
            })
            .eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, plan')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) break;

        const status = subscription.status;
        // Map Stripe status to our subscription_status
        const statusMap = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'cancelled',
          unpaid: 'past_due',
          trialing: 'active',
        };

        const updates = {
          subscription_status: statusMap[status] || 'inactive',
        };

        // If cancelled, set expiry to period end
        if (status === 'canceled') {
          updates.plan_expires_at = new Date(
            subscription.current_period_end * 1000
          ).toISOString();
        }

        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', profile.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) break;

        await supabase
          .from('profiles')
          .update({
            plan: 'trial',
            subscription_status: 'inactive',
            stripe_subscription_id: null,
            plan_expires_at: null,
          })
          .eq('id', profile.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) break;

        await supabase
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('id', profile.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }

  return res.status(200).json({ received: true });
}
