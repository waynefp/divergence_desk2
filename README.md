# DivergenceDesk

Cross-venue event contract surveillance: finds the same real-world event priced
differently on Kalshi and Polymarket, and uses Claude to pair equivalent
contracts and flag resolution-criteria differences — framed through an options
trader's lens.

## How it works

- `/api/kalshi` — server route, pulls top open markets from Kalshi's public
  Trade API v2 and normalizes them (no API key needed).
- `/api/polymarket` — server route, pulls top markets from Polymarket's public
  Gamma API and normalizes them (no API key needed).
- `/api/match` — server route, sends both market lists to Claude
  (claude-sonnet-4-6), which returns matched pairs with confidence levels and
  analyst notes. Requires `ANTHROPIC_API_KEY`.
- `/` — the dashboard. Scan, then Match, then read divergences sorted by gap.

Server-side fetching means no CORS issues — everything runs live.

## Local dev

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: Add New Project → import the repo. Framework auto-detects as
   Next.js — no build settings needed.
3. In the project's Settings → Environment Variables, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
4. Deploy. Done.

Or from the CLI: `npx vercel` from this folder, then add the env var with
`npx vercel env add ANTHROPIC_API_KEY`.

## Notes

- Scans are capped at the top 40 markets per venue by volume to keep the
  matching call fast and cheap. Raise the caps in the two route files as
  needed.
- Next steps on the roadmap: cache AI matches, snapshot history to a database
  (Supabase), divergence-over-time charts per pair.
