export const dynamic = "force-dynamic";

const BASE =
  "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false";

const CATEGORY_KEYWORDS = {
  economics: [
    "fed", "fomc", "rate cut", "rate hike", "interest rate", "interest rates",
    "cpi", "inflation", "gdp", "recession", "payroll", "payrolls",
    "jobs report", "unemployment",
  ],
  crypto: [
    "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "xrp", "dogecoin",
    "crypto",
  ],
  politics: [
    "election", "president", "congress", "house", "senate", "governor",
    "shutdown", "midterm", "midterms", "nominee", "impeach", "impeachment",
    "cabinet", "supreme court",
  ],
};

// Word-boundary matching so "fed" can't match "Federico".
function matchesCategory(text, category) {
  const kws = CATEGORY_KEYWORDS[category];
  if (!kws) return true;
  return kws.some((k) => {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b" + esc + "\\b", "i").test(text);
  });
}

function parseGameStart(v) {
  if (!v) return null;
  const iso = String(v).replace(" ", "T").replace(/\+00$/, "Z");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req) {
  const category = (
    new URL(req.url).searchParams.get("category") || "all"
  ).toLowerCase();

  try {
    // Top 500 by 24h volume — deep enough to reach econ/politics past sports.
    const pages = await Promise.all(
      [0, 100, 200, 300, 400].map((offset) =>
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

        const question = m.question || m.title || "";

        if (category === "sports") {
          // Sports: use Polymarket's own tagging instead of keywords, and
          // frame the first outcome as the yes-side so titles carry teams.
          if (m.sportsMarketType !== "moneyline") continue;
          const start = parseGameStart(m.gameStartTime);
          if (!start || start.getTime() <= Date.now()) continue; // skip live/settled
          const p0 = Number(prices[0]);
          if (!(p0 > 0.01 && p0 < 0.99)) continue;
          out.push({
            id: String(m.id),
            title: question + " \u2014 " + String(outcomes[0]) + " win",
            prob: p0,
            volume: Number(m.volume24hr || m.volumeNum || m.volume || 0),
            close: (m.endDate || "").slice(0, 10),
            rules: (m.description || "").slice(0, 300),
          });
          continue;
        }

        // Non-sports: binary Yes/No markets, keyword-filtered by category.
        const yi = outcomes.findIndex(
          (o) => String(o).toLowerCase() === "yes"
        );
        if (yi === -1) continue;
        const p = Number(prices[yi]);
        if (!(p > 0 && p < 1)) continue;
        if (!matchesCategory(question, category)) continue;

        out.push({
          id: String(m.id),
          title: question,
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
