// Login check for every API route: the caller must be signed in AND on the allowed list.
export const SUPABASE_URL = 'https://clteinrzpebrkrkthsvx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdGVpbnJ6cGVicmtya3Roc3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3ODU0MTUsImV4cCI6MjEwNTM2MTQxNX0.EO4rB4sMIEwLlUlec2Ep4MB9a47vF0r_zflUOzdJX9Y';

// Returns the user's access token, or null after sending a 401/403.
export async function requireUser(req, res) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { res.status(401).json({ error: 'Not logged in' }); return null; }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_allowed`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (r.status === 401) { res.status(401).json({ error: 'Not logged in' }); return null; }
    const ok = await r.json();
    if (ok !== true) { res.status(403).json({ error: 'No access' }); return null; }
    return token;
  } catch (e) {
    res.status(500).json({ error: 'Login check failed' }); return null;
  }
}
