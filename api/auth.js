import { addOrUpdateContact } from './mailchimp.js';
import { sendWelcomeEmail } from './email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, name, token } = req.body;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    if (action === 'signup') {
      if (!email || !password) return res.status(400).json({ error: 'Missing required fields' });
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password, data: { full_name: name || '' } })
      });
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: data.error_description || data.msg || 'Signup failed' });

      // Add to Mailchimp
      try {
        await addOrUpdateContact({
          email,
          firstName: name || '',
          tags: ['trial', 'metaphor-builder'],
        });
      } catch (mcErr) {
        console.error('Mailchimp signup sync error (non-fatal):', mcErr);
      }

      // Send welcome email
      try {
        await sendWelcomeEmail({ email, name: name || '' });
      } catch (emailErr) {
        console.error('Welcome email error (non-fatal):', emailErr);
      }

      return res.status(200).json({ user: data.user, session: data.session || data });
    }

    if (action === 'login') {
      if (!email || !password) return res.status(400).json({ error: 'Missing required fields' });
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) return res.status(401).json({ error: data.error_description || 'Incorrect email or password' });
      return res.status(200).json({ user: data.user, session: data });
    }

    if (action === 'forgot') {
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return res.status(400).json({ error: data.error_description || 'Could not send reset email' });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
