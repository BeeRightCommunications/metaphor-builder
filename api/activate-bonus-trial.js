import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: 'Missing plan' });

  const { data: profile } = await supabase
      .from('profiles')
      .select('bonus_trial_plan, plan, subscription_status')
      .eq('id', userId)
      .single();

  if (profile?.subscription_status === 'active') {
        return res.status(200).json({ activated: false, reason: 'already_active' });
  }

  if (profile?.bonus_trial_plan) {
        return res.status(200).json({ activated: false, reason: 'already_granted' });
  }

  await supabase
      .from('profiles')
      .update({
              bonus_trial_active: true,
              bonus_trial_plan: plan,
              bonus_trial_quick_used: 0,
              bonus_trial_full_used: 0,
      })
      .eq('id', userId);

  return res.status(200).json({ activated: true });
}
