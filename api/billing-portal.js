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
                    let userId;
                      try {
                          const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                              const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
                                  userId = payload.sub;
                                    } catch {
                                        return res.status(401).json({ error: 'Invalid token' });
                                          }

                                            const { data: profile, error } = await supabase
                                                .from('profiles')
                                                    .select('stripe_customer_id')
                                                        .eq('id', userId)
                                                            .single();

                                                              if (error || !profile?.stripe_customer_id) {
                                                                  return res.status(400).json({
                                                                        error: 'No billing account found for this user yet. Subscribe first, then you can manage it here.',
                                                                            });
                                                                              }

                                                                                try {
                                                                                    const session = await stripe.billingPortal.sessions.create({
                                                                                          customer: profile.stripe_customer_id,
                                                                                                return_url: 'https://metaphorbuilder.app/',
                                                                                                    });
                                                                                                        return res.status(200).json({ url: session.url });
                                                                                                          } catch (err) {
                                                                                                              return res.status(500).json({ error: err.message || 'Could not open billing portal' });
                                                                                                                }
                                                                                                                }
                                                                                                                
