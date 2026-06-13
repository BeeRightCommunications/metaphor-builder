export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': authHeader
  };

  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/saved_metaphors?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: 'Failed to fetch library' });
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
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ title, distinction, theme, metaphor_text, hypnotic_text, therapist_note, mode, user_id: req.headers['x-user-id'] })
        }
      );
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: 'Failed to save metaphor' });
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
        { method: 'DELETE', headers }
      );
      if (!response.ok) return res.status(400).json({ error: 'Failed to delete metaphor' });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
