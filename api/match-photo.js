// Return item + Inventory check: match a photo against everything stored in one household.
const SUPABASE_URL = 'https://clteinrzpebrkrkthsvx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdGVpbnJ6cGVicmtya3Roc3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3ODU0MTUsImV4cCI6MjEwNTM2MTQxNX0.EO4rB4sMIEwLlUlec2Ep4MB9a47vF0r_zflUOzdJX9Y';

const PROMPT = (list, checkBox) => `You help return household items to their storage boxes in a Slovak household.
The photo shows one or more items spread out.
${checkBox ? `The user is checking box ${checkBox}. Entries in that box are listed first; prefer them when an item fits.\n` : ''}
DATABASE (format: index|name|color|keywords|box):
${list}

For EVERY distinct physical item in the photo:
- describe it briefly in English and Slovak
- find matching database entries: same kind of item AND compatible color/look/brand
- if identical-looking entries exist in DIFFERENT boxes, include all of them (max 3)
- if nothing matches, return an empty matches array

Reply with ONLY valid JSON:
{"items":[{"desc_en":"Black USB-C cable","desc_sk":"Čierny USB-C kábel","matches":[12],"confidence":"high"}]}
confidence: high | medium | none`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { imageBase64, householdId, checkBoxId } = req.body || {};
    const hh = parseInt(householdId, 10);
    if (!imageBase64 || !hh) return res.status(400).json({ error: 'Missing image or household' });

    // read everything (the server returns max 1000 rows per request)
    let items = [];
    for (let from = 0; ; from += 1000) {
      const q = `${SUPABASE_URL}/rest/v1/all_items?select=id,source,name_en,name_sk,color,keywords,box_id,box_label_en,box_label_sk,box_emoji,box_hex,family_id&household_id=eq.${hh}&order=id&offset=${from}&limit=1000`;
      const dr = await fetch(q, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
      const page = await dr.json();
      if (!dr.ok) throw new Error(page.message || 'Database error');
      items.push(...page);
      if (page.length < 1000) break;
    }
    const cb = checkBoxId ? String(checkBoxId) : null;
    if (cb) items.sort((a, b) => (b.family_id === cb) - (a.family_id === cb));
    items = items.slice(0, 2500);   // prompt size cap; the checked box's items stay first
    const cbItem = cb && items.find(i => i.family_id === cb);
    const checkBox = cbItem ? cbItem.box_label_en : null;

    const clean = s => String(s || '').replace(/[|\n]/g, ' ').slice(0, 160);
    const list = items.map((i, n) => `${n}|${clean(i.name_en || i.name_sk)}${i.name_sk && i.name_en ? ' / ' + clean(i.name_sk) : ''}|${clean(i.color)}|${clean(i.keywords)}|${clean(i.box_label_en)}`).join('\n');

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: PROMPT(list || '(empty)', checkBox) }
        ] }]
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || 'Vision API error' });

    const text = (data.content || []).find(c => c.type === 'text')?.text || '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const out = (parsed.items || []).map(d => {
      const matches = (d.matches || []).map(n => items[n]).filter(Boolean).slice(0, 3);
      const boxes = [...new Set(matches.map(m => m.family_id))];
      return { desc_en: d.desc_en, desc_sk: d.desc_sk, confidence: d.confidence,
        status: matches.length === 0 ? 'unknown' : boxes.length === 1 ? 'match' : 'choose', matches };
    });
    return res.status(200).json({ items: out, total: items.length });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
