export const dynamic = "force-dynamic";

const BASE =
  "https://external-api.kalshi.com/trade-api/v2/markets?status=open&limit=1000";

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
  if (!kws) return true; // "all" or unknown -> no filter
  const t = text.toLowerCase();
  return kws.some((k) => t.includes(k));
}

export async function GET(req) {
  const category = (
    new URL(req.url).searchParams.get("category") || "all"
  ).toLowerCase();

  try {
    const r = await fetch(BASE, { cache: "no-store" });
    if (!r.ok) throw new Error("Kalshi HTTP " + r.status);
    const data = await r.json();

    const out = [];
    for (const m of data?.markets || []) {
      const bid = Number(m.yes_bid),
        ask = Number(m.yes_ask),
        last = Number(m.last_price);
      let cents = null;
      if (bid > 0 && ask > 0) cents = (bid + ask) / 2;
      else if (last > 0) cents = last;
      if (cents == null) continue;

      const vol = Number(m.volume || m.volume_24h || 0);
      if (vol < 100) continue;

      const title = [m.title, m.yes_sub_title || m.subtitle]
        .filter(Boolean)
        .join(" — ");

      if (!matchesCategory(title + " " + (m.ticker || ""), category)) continue;

      out.push({
        id: m.ticker,
        title,
        prob: cents / 100,
        volume: vol,
        close: (m.close_time || "").slice(0, 10),
        rules: (m.rules_primary || "").slice(0, 300),
      });
    }
    out.sort((a, b) => b.volume - a.volume);

    return Response.json({ category, markets: out.slice(0, 50) });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
