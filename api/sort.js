export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { image, mediaType, boxes } = req.body || {};
  if (!image) return res.status(400).json({ error: 'missing image' });

  const boxList = (boxes && boxes.length) ? boxes : [
    'Kitchen', 'Bathroom', 'Bedroom', 'Office / Desk', 'Tools', 'Donate', 'Trash', 'Miscellaneous'
  ];

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
              text: `You are sorting a household item into one of these boxes: ${boxList.join(', ')}. Look at the photo and respond ONLY with raw JSON, no markdown fences: {"box": "<one of the box names exactly>", "reason": "<one short sentence>"}`
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
    if (!boxList.includes(parsed.box)) parsed.box = 'Miscellaneous';
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(200).json({ box: 'Miscellaneous', reason: 'Sorting failed server-side.' });
  }
}
