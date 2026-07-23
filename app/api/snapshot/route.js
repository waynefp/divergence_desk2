import { getSql, CATEGORIES } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Called on a schedule (Vercel Cron or n8n) to capture a point-in-time
// snapshot of both venues. Protected by CRON_SECRET when that is set.
async function handler(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    const qs = new URL(req.url).searchParams.get("key") || "";
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const only = new URL(req.url).searchParams.get("category");
  const cats = only ? [only.toLowerCase()] : CATEGORIES;

  const results = {};
  let total = 0;

  for (const cat of cats) {
    try {
      const [kr, pr] = await Promise.all([
        fetch(`${origin}/api/kalshi?category=${cat}`, { cache: "no-store" }),
        fetch(`${origin}/api/polymarket?category=${cat}`, {
          cache: "no-store",
        }),
      ]);
      const kd = await kr.json();
      const pd = await pr.json();

      const rows = [
        ...(kd.markets || []).map((m) => ({ ...m, venue: "kalshi" })),
        ...(pd.markets || []).map((m) => ({ ...m, venue: "polymarket" })),
      ];

      for (const r of rows) {
        await sql`
          INSERT INTO snapshots
            (venue, market_id, category, title, prob, volume, close_date)
          VALUES
            (${r.venue}, ${r.id}, ${cat}, ${r.title}, ${r.prob},
             ${r.volume || 0}, ${r.close || null})
        `;
      }

      results[cat] = {
        kalshi: (kd.markets || []).length,
        polymarket: (pd.markets || []).length,
      };
      total += rows.length;
    } catch (e) {
      results[cat] = { error: String(e.message || e) };
    }
  }

  return Response.json({ ok: true, inserted: total, results });
}

export const GET = handler;
export const POST = handler;
