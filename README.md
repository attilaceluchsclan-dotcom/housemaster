# Housemaster — Snap & Sort

Claude does the sorting (vision, same as before). Real Supabase database.
Deployed as a real site — no sandbox, camera works.

## 1. Supabase (5 min)
1. supabase.com → new project (free tier).
2. SQL Editor → paste `supabase-schema.sql` → Run.
3. Settings → API → copy `Project URL` and `anon public` key.

## 2. Fill in the keys
In `public/index.html`, replace:
- `__SUPABASE_URL__` → your Project URL
- `__SUPABASE_ANON_KEY__` → your anon key

(The anon key is meant to be public — it's restricted by the row-level
security policies in the schema, not secret.)

## 3. Deploy to Vercel
- Push this folder to a GitHub repo, then import it at vercel.com → New Project.
- Or from a terminal: `npx vercel` inside this folder, follow the prompts.
- In Vercel → Project → Settings → Environment Variables, add:
  `ANTHROPIC_API_KEY` = your Anthropic API key (console.anthropic.com → API Keys)
- Redeploy after adding the env var.

## 4. Open it
Visit the vercel.app URL Vercel gives you, in Chrome/Samsung Internet — not
inside an app webview. Add to home screen for an app-like icon.

## What's NOT built (parked, per plan)
- pgvector embeddings / "seen this before" matching — Phase 3/4, skipped.
  Claude vision does the sorting for now instead.
- Importing the 156 archived photos — do this after the live flow is
  confirmed working end to end; say the word and it gets scripted.
