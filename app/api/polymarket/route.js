export const dynamic = "force-dynamic";

const BASE =
  "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false";

const CATEGORY_KEYWORDS = {
  economics: [
    "fed", "rate cut", "rate hike", "interest rate", "cpi", "inflation",
    "gdp", "recession", "payroll", "jobs report", "unemployment", "fomc",
  ],
  crypto: [
    "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "xrp", "dogecoin",
    "crypto",
  ],
  politics: [
    "election", "president", "congress", "house", "senate", "governor",
    "shutdown", "midterm", "nominee", "impeach", "cabinet", "supreme court",
  ],
};

function matchesCategory(text, category) {
  const kws = CATEGORY_KEYWORDS[category];
  if (!kws) return true;
  const t = text.toLowerCase();
  return kws.some((k) => t.includes(k));
}

export async function GET(req) {
  const category = (
    new URL(req.url).searchParams.get("category") || "all"
  ).toLowerCase();

  try {
    // Pull 3 pages (300 markets) so category filtering has depth to work with
    const pages = await Promise.all(
      [0, 100, 200].map((offset) =>
        fetch(BASE + "&offset=" + offset, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : []
        )
      )
    );
    const arr = pages.flatMap((p) => (Array.isArray(p) ? p : p?.markets || []));

    const out = [];
    for (const m of arr) {
      try {
        const outcomes =
          typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes;
        const prices =
          typeof m.outcomePrices === "string"
            ? JSON.parse(m.outcomePrices)
            : m.outcomePrices;
        if (!outcomes || !prices) continue;

        const yi = outcomes.findIndex(
          (o) => String(o).toLowerCase() === "yes"
        );
        if (yi === -1) continue;

        const p = Number(prices[yi]);
        if (!(p > 0 && p < 1)) continue;

        const title = m.question || m.title || "";
        if (!matchesCategory(title, category)) continue;

        out.push({
          id: String(m.id),
          title,
          prob: p,
          volume: Number(m.volume24hr || m.volumeNum || m.volume || 0),
          close: (m.endDate || "").slice(0, 10),
          rules: (m.description || "").slice(0, 300),
        });
      } catch {
        continue;
      }
    }
    out.sort((a, b) => b.volume - a.volume);

    return Response.json({ category, markets: out.slice(0, 50) });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
