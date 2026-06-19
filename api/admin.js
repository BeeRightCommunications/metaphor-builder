import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  // --- All signups ---
  const { data: allUsers } = await supabase
    .from('profiles')
    .select('email, plan, subscription_status, trial_quick_used, trial_full_used, created_at')
    .order('created_at', { ascending: false });

  // --- Trial exhausted (hot leads) ---
  const trialExhausted = (allUsers || []).filter(
    u => u.plan === 'trial' && u.trial_quick_used >= 2 && u.trial_full_used >= 1
  );

  // --- Drop-offs (signed up, never generated) ---
  const dropOffs = (allUsers || []).filter(
    u => u.plan === 'trial' && u.trial_quick_used === 0 && u.trial_full_used === 0
  );

  // --- Active trialists ---
  const activeTrials = (allUsers || []).filter(
    u => u.plan === 'trial' && (u.trial_quick_used > 0 || u.trial_full_used > 0)
       && !(u.trial_quick_used >= 2 && u.trial_full_used >= 1)
  );

  // --- Paid / founding ---
  const converted = (allUsers || []).filter(
    u => ['monthly', 'annual', 'lifetime', 'founding'].includes(u.plan)
  );

  return res.status(200).json({
    summary: {
      total: allUsers?.length || 0,
      converted: converted.length,
      trialExhausted: trialExhausted.length,
      activeTrials: activeTrials.length,
      dropOffs: dropOffs.length,
    },
    users: {
      all: allUsers || [],
      converted,
      trialExhausted,
      activeTrials,
      dropOffs,
    }
  });
}
