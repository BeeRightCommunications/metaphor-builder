export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  // Use anon key with user JWT for reads (respects RLS)
  const userHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': authHeader
  };

  // Use service key for writes (bypasses RLS safely server-side)
  const serviceHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
  };

  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/saved_metaphors?select=*&order=created_at.desc`,
        { headers: userHeaders }
      );
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: 'Failed to fetch', detail: data });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { title, distinction, theme, metaphor_text, hypnotic_text, therapist_note, mode } = req.body;
    const userId = req.headers['x-user-id'];
    if (!title || !metaphor_text) return res.status(400).json({ error: 'Missing required fields' });
    if (!userId) return res.status(400).json({ error: 'Missing user id' });
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/saved_metaphors`,
        {
          method: 'POST',
          headers: { ...serviceHeaders, 'Prefer': 'return=representation' },
          body: JSON.stringify({ title, distinction, theme, metaphor_text, hypnotic_text, therapist_note, mode, user_id: userId })
        }
      );
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: 'Failed to save', detail: data });
      return res.status(200).json(data[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing metaphor id' });
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/saved_metaphors?id=eq.${id}`,
        { method: 'DELETE', headers: serviceHeaders }
      );
      if (!response.ok) return res.status(400).json({ error: 'Failed to delete' });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
