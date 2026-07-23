# DivergenceDesk

**Cross-venue event contract surveillance.** DivergenceDesk finds the same
real-world event priced differently on [Kalshi](https://kalshi.com) and
[Polymarket](https://polymarket.com), then uses an LLM to pair equivalent
contracts and explain each price gap the way a derivatives analyst would —
distinguishing genuine mispricing from contracts that merely *look* the same
but resolve differently.

🔗 **Live:** https://divergence-desk2.vercel.app

---

## Why this exists

Prediction markets are becoming a real asset class — Kalshi and Polymarket now
run liquid markets on Fed decisions, elections, crypto levels, and individual
sporting events, and operators like DraftKings are building CFTC-regulated
prediction exchanges of their own. When two venues list the same event, their
implied probabilities routinely diverge.

In listed options, a price gap on the "same" instrument is one of two things:
an arbitrage, or a signal that the two instruments aren't actually identical.
DivergenceDesk applies that discipline to event contracts. The hard part isn't
displaying two prices side by side — it's answering *"are these really the same
contract?"* before anyone treats the gap as edge. That question is where the
AI earns its place.

## What it does

1. **Scans both venues** for open markets in a chosen category (Economics,
   Crypto, Politics, Sports, or All), pulling live prices, volume, and
   resolution rules from each platform's public API.
2. **Pairs equivalent contracts with an LLM.** Claude reads the contract titles
   and resolution text from both venues and returns matched pairs, each with a
   confidence level and a one-sentence analyst note flagging any
   resolution-criteria difference worth knowing before trading the gap.
3. **Ranks divergences by tradability, not raw size.** A gap is weighted by the
   *thinner* side's liquidity, so a small gap between two deep markets outranks
   a large gap against a near-empty one. Low-liquidity pairs are badged `THIN`
   and carry an explicit stale-quote caution.

Every contract is framed in derivatives language — implied probability,
American odds, put-call-parity analogies — via an "options lens" that doubles
as an educational layer.

### The analyst notes are the point

A few unedited examples the model produced on live contracts:

> *Kalshi resolves on the specific October 2026 decision date while Polymarket
> 'Fed Rate Hike by October 2026' closes 2026-12-09, suggesting Polymarket
> resolves YES if any hike occurred at or before October — timing and
> cumulative vs single-meeting logic must be confirmed.*

> *Both cover Chicago White Sox winning CWS-TEX; double-check Polymarket data
> feed distinguishes White Sox from Cubs given both Chicago teams play the same
> evening.*

> *Kalshi uses 'A's' abbreviation while Polymarket uses 'Athletics' — confirm
> neither platform has a legacy Oakland/Sacramento identifier that could cause
> mismatch.*

These aren't templated. They're generated per pair from the live resolution
text, and they catch exactly the traps that turn an apparent arbitrage into a
losing trade.

## Architecture

```
Browser (Next.js client)
      |  Scan             |  Match
      v                   v
/api/kalshi         /api/match  --->  Anthropic API (Claude)
/api/polymarket
      |
      v
Kalshi + Polymarket public APIs
```

- **Next.js (App Router) on Vercel.** Server-side API routes do all external
  fetching, which eliminates browser CORS issues and keeps the Anthropic key
  server-side.
- **`/api/kalshi`** queries Kalshi's Trade API by *series ticker* (e.g. the Fed,
  CPI, and single-game MLB series), the reliable way to reach live markets in a
  catalog of tens of thousands, and normalizes the response.
- **`/api/polymarket`** pulls the top markets by 24-hour volume from the Gamma
  API and filters them by category — keyword matching for topics, and
  Polymarket's own `moneyline` tagging for sports.
- **`/api/match`** sends both normalized market lists to Claude with a
  structured-JSON prompt and parses the matched pairs.
- **Client** computes implied-probability divergence, applies the
  liquidity-weighted ranking, and renders the board.

No API keys are required for the market data — both venues expose public
read endpoints. Only the AI matching step needs an Anthropic key.

## Running locally

```bash
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open http://localhost:3000, choose a category, then **Scan** -> **Match**.

## Deploying

Push to a Git repo, import it into Vercel (framework auto-detects as Next.js),
and add `ANTHROPIC_API_KEY` under Settings -> Environment Variables. Every push
redeploys.

## Engineering notes

A few problems that shaped the build, kept here because the workarounds are the
interesting part:

- **Kalshi silently changed its response schema.** Price fields moved from
  integer cents (`yes_bid`) to dollar strings (`yes_bid_dollars`), and the
  failure mode was an *empty list*, not an error — every market got filtered
  out as "unpriced." Fixed by reading the new fields with a fallback to the old
  ones. This was the single most time-consuming bug and the least visible.
- **Naive top-volume scanning finds no overlap.** Each venue's highest-volume
  markets barely intersect, so the first working version returned zero matches.
  The fix was category-targeted querying: series tickers on Kalshi, deep
  volume-sorted pulls plus filtering on Polymarket.
- **Substring keyword matching is a trap.** Filtering economics markets on
  `"fed"` pulled in a *Ballon d'Or* market — because "Federico" contains "fed."
  Switched to word-boundary matching.
- **Asymmetric liquidity fakes divergence.** A wide gap where one side has
  almost no volume is usually a stale quote, not disagreement — the
  prediction-market version of a wide, untraded options series. The ranking
  weights gaps by the thinner side's liquidity and flags thin pairs explicitly.

## Roadmap

- **Persistence (v2):** snapshot both venues on a schedule into a database,
  cache AI matches instead of re-running per visit, and chart
  divergence-over-time per pair — turning the app from a live viewer into a
  dataset.
- Confidence filtering to hide or collapse low-match pairs.
- Additional venues as more regulated exchanges expose public data.

## Stack

Next.js · React · Vercel · Anthropic API (Claude) · Kalshi & Polymarket public
APIs

---

*Built as a demonstration of applied-AI product engineering: live data
integration, LLM-driven semantic matching with domain-aware prompting, and
financial-markets reasoning. Not affiliated with Kalshi or Polymarket, and not
intended as trading advice.*
