import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

const LIFETIME_ANNUAL_CAP = 1000;

export async function checkAccess(userId, mode) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('plan, subscription_status, plan_expires_at, trial_quick_used, trial_full_used, monthly_generations, monthly_reset_at, annual_generations, annual_reset_at')
      .eq('id', userId)
      .single();

  if (error || !profile) {
        return { allowed: false, reason: 'Profile not found' };
  }

  const { plan, subscription_status, plan_expires_at, trial_quick_used, trial_full_used } = profile;

  if (plan === 'founding') {
        if (plan_expires_at && new Date(plan_expires_at) < new Date()) {
                await supabase.from('profiles').update({ plan: 'trial' }).eq('id', userId);
                return { allowed: false, reason: 'founding_expired', trialQuickUsed: 0, trialFullUsed: 0 };
        }
        return { allowed: true };
  }

  if (plan === 'lifetime' && subscription_status === 'active') {
        const now = new Date();
        const resetAt = profile.annual_reset_at ? new Date(profile.annual_reset_at) : null;
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

      let annualGenerations = profile.annual_generations ?? 0;

      if (!resetAt || resetAt < yearAgo) {
              annualGenerations = 0;
              await supabase.from('profiles')
                .update({ annual_generations: 0, annual_reset_at: now.toISOString() })
                .eq('id', userId);
      }

      if (annualGenerations >= LIFETIME_ANNUAL_CAP) {
              return { allowed: false, reason: 'lifetime_cap_reached' };
      }

      await supabase.from('profiles')
          .update({ annual_generations: annualGenerations + 1 })
          .eq('id', userId);

      return { allowed: true, lifetimeRemaining: LIFETIME_ANNUAL_CAP - (annualGenerations + 1) };
  }

  if (plan === 'student' && subscription_status === 'active') {
        const STUDENT_MONTHLY_CAP = 10;
        const resetAt = new Date(profile.monthly_reset_at);
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        let monthlyGenerations = profile.monthly_generations ?? 0;

      if (!profile.monthly_reset_at || resetAt < monthAgo) {
              monthlyGenerations = 0;
              await supabase.from('profiles')
                .update({ monthly_generations: 0, monthly_reset_at: now.toISOString() })
                .eq('id', userId);
      }

      if (monthlyGenerations >= STUDENT_MONTHLY_CAP) {
              return { allowed: false, reason: 'student_cap_reached' };
      }

      await supabase.from('profiles')
          .update({ monthly_generations: monthlyGenerations + 1 })
          .eq('id', userId);

      return { allowed: true, studentRemaining: STUDENT_MONTHLY_CAP - (monthlyGenerations + 1) };
  }

  if ((plan === 'monthly' || plan === 'annual') && subscription_status === 'active') {
        const resetAt = new Date(profile.monthly_reset_at);
        const now = new Date();
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        let monthlyGenerations = profile.monthly_generations ?? 0;

      if (!profile.monthly_reset_at || resetAt < monthAgo) {
              monthlyGenerations = 0;
              await supabase.from('profiles')
                .update({ monthly_generations: 0, monthly_reset_at: now.toISOString() })
                .eq('id', userId);
      }

      await supabase.from('profiles')
          .update({ monthly_generations: monthlyGenerations + 1 })
          .eq('id', userId);

      return { allowed: true };
  }

  if (subscription_status === 'past_due') {
        return { allowed: true, warning: 'payment_past_due' };
  }

  if (plan === 'trial' || !plan) {
        if (mode === 'quick') {
                if (trial_quick_used >= 2) {
                          return { allowed: false, reason: 'trial_quick_exhausted', trialQuickUsed: trial_quick_used, trialFullUsed: trial_full_used };
                }
                await supabase.from('profiles')
                  .update({ trial_quick_used: trial_quick_used + 1 })
                  .eq('id', userId);
                return { allowed: true, trialRemaining: { quick: 2 - (trial_quick_used + 1), full: 1 - trial_full_used } };
        }

      if (mode === 'full') {
              if (trial_full_used >= 1) {
                        return { allowed: false, reason: 'trial_full_exhausted', trialQuickUsed: trial_quick_used, trialFullUsed: trial_full_used };
              }
              await supabase.from('profiles')
                .update({ trial_full_used: trial_full_used + 1 })
                .eq('id', userId);
              return { allowed: true, trialRemaining: { quick: 2 - trial_quick_used, full: 0 } };
      }
  }

  return { allowed: false, reason: 'no_active_subscription' };
}
