export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, name } = req.body;
  if (!action || !email || !password) return res.status(400).json({ error: 'Missing required fields' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  try {
    if (action === 'signup') {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password, data: { full_name: name || '' } })
      });
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: data.error_description || data.msg || 'Signup failed' });
      return res.status(200).json({ user: data.user, session: data.session });
    }

    if (action === 'login') {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) return res.status(401).json({ error: data.error_description || 'Incorrect email or password' });
      return res.status(200).json({ user: data.user, session: data });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
