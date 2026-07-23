import { getSql } from "../../../lib/db";

export const dynamic = "force-dynamic";

// POST { pairs: [{ kalshi_id, poly_id }] }
// Returns { series: { "<kalshi_id>|<poly_id>": [{ t, k, p, gap }, ...] } }
// Each venue's snapshots are bucketed to the hour so the two sides line up.
export async function POST(req) {
  const sql = getSql();
  if (!sql) return Response.json({ series: {}, disabled: true });

  try {
    const { pairs } = await req.json();
    if (!Array.isArray(pairs) || !pairs.length) {
      return Response.json({ series: {} });
    }

    const kIds = [...new Set(pairs.map((p) => p.kalshi_id))];
    const pIds = [...new Set(pairs.map((p) => p.poly_id))];
    const ids = [...kIds, ...pIds];

    const rows = await sql`
      SELECT market_id,
             venue,
             date_trunc('hour', captured_at) AS bucket,
             AVG(prob) AS prob
      FROM snapshots
      WHERE market_id = ANY(${ids})
        AND captured_at > NOW() - INTERVAL '14 days'
      GROUP BY market_id, venue, bucket
      ORDER BY bucket ASC
    `;

    // market_id -> { iso bucket -> prob }
    const byMarket = {};
    for (const r of rows) {
      const key = String(r.market_id);
      if (!byMarket[key]) byMarket[key] = {};
      byMarket[key][new Date(r.bucket).toISOString()] = Number(r.prob);
    }

    const series = {};
    for (const pair of pairs) {
      const k = byMarket[String(pair.kalshi_id)] || {};
      const p = byMarket[String(pair.poly_id)] || {};
      const shared = Object.keys(k)
        .filter((t) => t in p)
        .sort();
      if (shared.length < 2) continue; // need at least two points to draw
      series[`${pair.kalshi_id}|${pair.poly_id}`] = shared.map((t) => ({
        t,
        k: k[t],
        p: p[t],
        gap: Math.abs(k[t] - p[t]),
      }));
    }

    return Response.json({ series });
  } catch (e) {
    return Response.json({ series: {}, error: String(e.message || e) });
  }
}
