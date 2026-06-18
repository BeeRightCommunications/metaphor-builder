import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Check if a user has access to generate a metaphor.
 * Returns { allowed: true } or { allowed: false, reason, trialQuickUsed, trialFullUsed }
 */
export async function checkAccess(userId, mode) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('plan, subscription_status, plan_expires_at, trial_quick_used, trial_full_used, monthly_generations, monthly_reset_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { allowed: false, reason: 'Profile not found' };
  }

  const { plan, subscription_status, plan_expires_at, trial_quick_used, trial_full_used } = profile;

  // --- FOUNDING MEMBERS: 12 months free ---
  if (plan === 'founding') {
    if (plan_expires_at && new Date(plan_expires_at) < new Date()) {
      // Founding period expired — treat as trial
      await supabase.from('profiles').update({ plan: 'trial' }).eq('id', userId);
      return { allowed: false, reason: 'founding_expired', trialQuickUsed: 0, trialFullUsed: 0 };
    }
    return { allowed: true };
  }

  // --- LIFETIME: always allowed ---
  if (plan === 'lifetime' && subscription_status === 'active') {
    return { allowed: true };
  }

  // --- PAID SUBSCRIPTIONS: monthly or annual ---
  if ((plan === 'monthly' || plan === 'annual') && subscription_status === 'active') {
    // Reset monthly counter if needed
    const resetAt = new Date(profile.monthly_reset_at);
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    if (resetAt < monthAgo) {
      await supabase.from('profiles')
        .update({ monthly_generations: 0, monthly_reset_at: now.toISOString() })
        .eq('id', userId);
    }
    return { allowed: true };
  }

  // --- PAST DUE: still allow access but flag it ---
  if (subscription_status === 'past_due') {
    return { allowed: true, warning: 'payment_past_due' };
  }

  // --- TRIAL: limited access ---
  if (plan === 'trial' || !plan) {
    if (mode === 'quick') {
      if (trial_quick_used >= 2) {
        return { allowed: false, reason: 'trial_quick_exhausted', trialQuickUsed: trial_quick_used, trialFullUsed: trial_full_used };
      }
      // Increment counter
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
