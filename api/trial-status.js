import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

function getUserId(req) {
        const authHeader = req.headers.authorization;
        if (!authHeader) return null;
        const token = authHeader.replace('Bearer ', '');
        try {
                  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
                  const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
                  return payload.sub;
        } catch {
                  return null;
        }
}

export default async function handler(req, res) {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: 'Unauthorised' });

  if (req.method === 'POST') {
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

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { data: profile } = await supabase
          .from('profiles')
          .select('plan, subscription_status, plan_expires_at, trial_quick_used, trial_full_used, bonus_trial_active, bonus_trial_plan, bonus_trial_quick_used, bonus_trial_full_used')
          .eq('id', userId)
          .single();

  if (!profile) return res.status(200).json({ paid: true });

  const { plan, subscription_status, plan_expires_at, trial_quick_used, trial_full_used } = profile;

  if (plan === 'founding') {
            const expired = plan_expires_at && new Date(plan_expires_at) < new Date();
            return res.status(200).json({ paid: !expired });
  }

  const paidPlans = ['lifetime', 'student', 'monthly', 'annual', 'legacy', 'legacy-course'];
        if (paidPlans.includes(plan) && subscription_status === 'active') {
                  return res.status(200).json({ paid: true });
        }

  if (profile.bonus_trial_active) {
            const quickLeft = Math.max(0, 1 - (profile.bonus_trial_quick_used || 0));
            const fullLeft = Math.max(0, 1 - (profile.bonus_trial_full_used || 0));
            return res.status(200).json({
                        paid: false,
                        trialExhausted: quickLeft <= 0 && fullLeft <= 0,
                        quickLeft,
                        fullLeft,
                        bonusPlan: profile.bonus_trial_plan,
            });
  }

  const quickLeft = Math.max(0, 2 - (trial_quick_used || 0));
        const fullLeft = Math.max(0, 1 - (trial_full_used || 0));
        return res.status(200).json({
                  paid: false,
                  trialExhausted: quickLeft <= 0 && fullLeft <= 0,
                  quickLeft,
                  fullLeft,
        });
}
