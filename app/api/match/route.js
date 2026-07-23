import { getSql } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not set in environment variables." },
      { status: 500 }
    );
  }

  try {
    const { kalshi, poly, category = "all", refresh } = await req.json();
    const sql = getSql();

    const kIds = new Set((kalshi || []).map((m) => String(m.id)));
    const pIds = new Set((poly || []).map((m) => String(m.id)));

    // 1. Try the cache first — matching is the slow, paid step.
    if (sql && !refresh) {
      try {
        const cached = await sql`
          SELECT kalshi_id, poly_id, confidence, note
          FROM matches
          WHERE category = ${category}
            AND created_at > NOW() - INTERVAL '6 hours'
        `;
        const usable = cached.filter(
          (m) => kIds.has(String(m.kalshi_id)) && pIds.has(String(m.poly_id))
        );
        if (usable.length) {
          return Response.json({ matches: usable, cached: true });
        }
      } catch {
        // cache miss or table not created yet — fall through to the API
      }
    }

    // 2. Ask Claude.
    const slim = (l) =>
      (l || []).slice(0, 50).map((m) => ({
        id: m.id,
        t: String(m.title || "").slice(0, 110),
        close: m.close,
      }));

    const prompt = `You are pairing equivalent binary event contracts across two prediction market platforms.

KALSHI markets:
${JSON.stringify(slim(kalshi))}

POLYMARKET markets:
${JSON.stringify(slim(poly))}

Pair contracts that refer to the SAME underlying outcome and comparable timeframe. Skip anything ambiguous. For each pair, add a one-sentence analyst note flagging any resolution-criteria difference an options trader should know before treating the price gap as an edge.

Respond with ONLY valid JSON, no markdown fences, in this exact shape:
{"matches":[{"kalshi_id":"...","poly_id":"...","confidence":"high|medium|low","note":"..."}]}
Maximum 12 matches.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return Response.json(
        { error: data?.error?.message || "Anthropic API error" },
        { status: 502 }
      );
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    const matches = parsed.matches || [];

    // 3. Write through to the cache.
    if (sql && matches.length) {
      try {
        for (const m of matches) {
          await sql`
            INSERT INTO matches (category, kalshi_id, poly_id, confidence, note)
            VALUES (${category}, ${String(m.kalshi_id)}, ${String(m.poly_id)},
                    ${m.confidence || null}, ${m.note || null})
            ON CONFLICT (kalshi_id, poly_id) DO UPDATE
              SET confidence = EXCLUDED.confidence,
                  note       = EXCLUDED.note,
                  category   = EXCLUDED.category,
                  created_at = NOW()
          `;
        }
      } catch {
        // caching is best-effort; never fail the request over it
      }
    }

    return Response.json({ matches, cached: false });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}
