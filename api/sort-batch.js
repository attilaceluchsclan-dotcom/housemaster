export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { image, mediaType } = req.body || {};
  if (!image) return res.status(400).json({ error: 'missing image' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `This photo shows a batch of household items that have already been pulled out to go into one specific storage bin together. Identify EVERY distinct item visible in the photo, separately — do not merge different items into one entry, and do not describe the whole group as a single thing.\n\nFor each distinct item, give a short specific name (e.g. "Phillips screwdriver, medium", not just "tool"). If several identical copies of the exact same item are visible together, you may combine them into one entry with a qty greater than 1 — but different items must always be separate entries.\n\nRespond ONLY with raw JSON, no markdown fences, no commentary: {"items": [{"item": "<short specific item name>", "qty": <integer count>}, ...]}\n\nIf you cannot make out any distinct items, respond with {"items": []}.`
            },
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const items = Array.isArray(parsed.items) ? parsed.items
      .filter(it => it && typeof it.item === 'string' && it.item.trim())
      .map(it => ({ item: it.item.trim(), qty: Number.isFinite(it.qty) && it.qty > 0 ? Math.round(it.qty) : 1 }))
      : [];
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(200).json({ items: [], error: 'Batch detection failed server-side.' });
  }
}
