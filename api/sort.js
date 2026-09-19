export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { image, mediaType, boxes } = req.body || {};
  if (!image) return res.status(400).json({ error: 'missing image' });

  // boxes: array of { name, keywords } from the client (Supabase boxes table).
  // Falls back to a generic set only if the client sent nothing.
  const boxRows = (boxes && boxes.length) ? boxes : [
    { name: 'Miscellaneous', keywords: 'anything that does not fit another category' }
  ];
  const boxNames = boxRows.map(b => (typeof b === 'string' ? b : b.name));
  const fallbackBox = boxNames.find(n => /misc/i.test(n)) || boxNames[boxNames.length - 1];

  const boxListText = boxRows.map(b => {
    if (typeof b === 'string') return `- ${b}`;
    return `- ${b.name}${b.keywords ? ` (examples: ${b.keywords})` : ''}`;
  }).join('\n');

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
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are sorting a household item into exactly one of these storage boxes. Each box lists example items it holds — use those to judge fit, don't go by the box name alone.\n\n${boxListText}\n\nLook at the photo and identify the item, then pick the single best-matching box. If nothing fits well, use "${fallbackBox}". Respond ONLY with raw JSON, no markdown fences: {"item": "<short specific item name>", "box": "<one of the box names exactly as listed>", "reason": "<one short sentence citing what the item is and why that box>"}`
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
    if (!boxNames.includes(parsed.box)) parsed.box = fallbackBox;
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(200).json({ item: '', box: fallbackBox, reason: 'Sorting failed server-side.' });
  }
}
