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
  sports: [
    "KXMLBGAME", "KXWNBAGAME", "KXNFLGAME", "KXNBAGAME", "KXNHLGAME",
    "KXMLSGAME", "KXUFC",
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
      // Kalshi now returns dollar-string price fields (e.g. yes_bid_dollars:
      // "0.4100") instead of integer cents; support both formats.
      const bid =
        parseFloat(m.yes_bid_dollars) || Number(m.yes_bid) / 100 || 0;
      const ask =
        parseFloat(m.yes_ask_dollars) || Number(m.yes_ask) / 100 || 0;
      const last =
        parseFloat(m.last_price_dollars) || Number(m.last_price) / 100 || 0;
      let prob = null;
      if (bid > 0 && ask > 0) prob = (bid + ask) / 2;
      else if (last > 0) prob = last;
      else if (ask > 0) prob = ask;
      if (prob == null || !(prob > 0 && prob < 1)) continue;

      const title = [m.title, m.yes_sub_title || m.subtitle]
        .filter(Boolean)
        .join(" — ")
        .replace(/\*\*/g, "");

      out.push({
        id: m.ticker,
        title,
        prob,
        volume:
          parseFloat(m.volume_fp) ||
          parseFloat(m.volume_24h_fp) ||
          Number(m.volume) ||
          0,
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
