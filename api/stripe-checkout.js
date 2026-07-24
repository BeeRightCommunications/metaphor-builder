import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

export default async function handler(req, res) {
    if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorised' });

  const token = authHeader.replace('Bearer ', '');
    let userId, userEmail;
    try {
          const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
          userId = payload.sub;
          userEmail = payload.email;
    } catch {
          return res.status(401).json({ error: 'Invalid token' });
    }

  const { plan } = req.body;
    if (!plan || !['monthly', 'annual', 'lifetime', 'student'].includes(plan)) {
          return res.status(400).json({ error: 'Invalid plan' });
    }

  const priceMap = {
        monthly: process.env.STRIPE_PRICE_MONTHLY,
        annual: process.env.STRIPE_PRICE_ANNUAL,
        lifetime: process.env.STRIPE_PRICE_LIFETIME,
        student: process.env.STRIPE_PRICE_STUDENT,
  };

  const priceId = priceMap[plan];

  let { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
        const customer = await stripe.customers.create({
                email: userEmail,
                metadata: { supabase_user_id: userId },
        });
        customerId = customer.id;
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);
  }

  const isSubscription = plan !== 'lifetime';

  const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: isSubscription ? 'subscription' : 'payment',
        success_url: `https://metaphorbuilder.app/?payment=success&plan=${plan}`,
        cancel_url: `https://metaphorbuilder.app/?payment=cancelled`,
        allow_promotion_codes: true,
        metadata: {
                supabase_user_id: userId,
                plan,
        },
  });

  return res.status(200).json({ url: session.url });
}
