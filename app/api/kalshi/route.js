export const dynamic = "force-dynamic";

const BASE = "https://external-api.kalshi.com/trade-api/v2/markets";

// Kalshi is queried by series ticker — the reliable way to reach live
// markets in a catalog of tens of thousands. Unknown/retired tickers
// simply return empty and are ignored.
const CATEGORY_SERIES = {
  economics: [
    "KXFED", "KXFEDDECISION", "KXCPI", "KXCPIYOY", "KXCPICORE",
    "KXCPICOREYOY", "KXU3", "KXPAYROLLS", "KXRECSSNBER", "KXMORTGAGERATE",
    "KXGDP",
  ],
  crypto: [
    "KXBTC", "KXBTCD", "KXETH", "KXETHD", "KXBTCMAXY", "KXBTCMINY",
    "KXETHMAXY",
  ],
  politics: [
    "KXUSAIRANAGREEMENT", "KXHOUSE", "KXSENATE", "KXPRES", "KXGOVSHUT",
    "KXCONTROL", "KXPRESPARTY",
  ],
};

async function fetchSeries(seriesTicker) {
  try {
    const url =
      BASE +
      "?status=open&limit=200&series_ticker=" +
      encodeURIComponent(seriesTicker);
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    return data?.markets || [];
  } catch {
    return [];
  }
}

export async function GET(req) {
  const category = (
    new URL(req.url).searchParams.get("category") || "all"
  ).toLowerCase();

  const seriesList =
    CATEGORY_SERIES[category] ||
    Object.values(CATEGORY_SERIES).flat(); // "all" = union of every category

  try {
    const results = await Promise.all(seriesList.map(fetchSeries));
    const raw = results.flat();

    const out = [];
    for (const m of raw) {
      const bid = Number(m.yes_bid),
        ask = Number(m.yes_ask),
        last = Number(m.last_price);
      let cents = null;
      if (bid > 0 && ask > 0) cents = (bid + ask) / 2;
      else if (last > 0) cents = last;
      if (cents == null) continue;

      out.push({
        id: m.ticker,
        title: [m.title, m.yes_sub_title || m.subtitle]
          .filter(Boolean)
          .join(" — "),
        prob: cents / 100,
        volume: Number(m.volume || m.volume_24h || 0),
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
