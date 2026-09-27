const BOXES = `
H1 = her: dresses
H2 = her: tops, shirts, t-shirts, blouses
H3 = her: trousers, jeans, leggings, skirts, shorts
H4 = her: underwear, bras, nightwear
H5 = her: socks, tights, stockings
H6 = her: sweaters, hoodies, cardigans
H7 = her: jackets, coats
H8 = her: damaged, very old, or unclear items
C1 = child: fits now
C2 = child: too small (outgrown)
C3 = child: too big (for later)`;

const PROMPT = `You are sorting clothes for a household storage app in a Slovak household.
The photo shows one or more garments laid flat.

Boxes:${BOXES}

Tasks:
1. List EVERY visible garment as its own entry. Identical garments = one entry with qty.
2. Suggest ONE box for the whole photo (the box most of the garments belong to).
   Child vs adult: judge by garment size and style. For child clothes you cannot tell
   whether they fit now, so default to C1.
3. Brand and size: only if a label is actually readable. Otherwise brand = "none visible",
   size = estimate + " (guess)".
4. Keywords: 3-5 search words incl. alternate names in English and Slovak (e.g. "hoodie, sweatshirt, mikina").

Reply with ONLY valid JSON, no other text:
{
  "suggested_box": "H1",
  "items": [
    {
      "name_en": "Black floral dress",
      "name_sk": "Čierne kvetované šaty",
      "color": "black/pink",
      "size": "M (guess)",
      "brand": "none visible",
      "qty": 1,
      "condition": "used",
      "keywords": "dress, floral dress, šaty, summer dress"
    }
  ]
}
condition must be one of: new, used, worn out.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { imageBase64, mediaType = 'image/jpeg' } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'No image' });

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: PROMPT }
          ]
        }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'Vision API error' });

    const text = (data.content || []).find(c => c.type === 'text')?.text || '';
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const valid = ['H1','H2','H3','H4','H5','H6','H7','H8','C1','C2','C3'];
    if (!valid.includes(json.suggested_box)) json.suggested_box = 'H8';
    json.items = Array.isArray(json.items) ? json.items : [];
    return res.status(200).json(json);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
