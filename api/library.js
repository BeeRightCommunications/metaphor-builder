export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  // Decode user ID directly from the JWT token
  let userId;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (!userId) return res.status(401).json({ error: 'Could not identify user' });

  const serviceHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
  };

  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/saved_metaphors?select=*&user_id=eq.${userId}&order=created_at.desc`,
        { headers: serviceHeaders }
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
    if (!title || !metaphor_text) return res.status(400).json({ error: 'Missing required fields' });
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
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/saved_metaphors?id=eq.${id}&user_id=eq.${userId}`,
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
