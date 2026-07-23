"use client";

import { useState, useMemo } from "react";

const C = {
  paper: "#F4F6F8",
  panel: "#FFFFFF",
  ink: "#12263A",
  inkSoft: "#5A6B7D",
  line: "#D8DFE6",
  kalshi: "#00915F",
  poly: "#4F5BD5",
  edge: "#D97706",
  edgeSoft: "#FEF3C7",
  good: "#0E7490",
};

const pct = (p) => (p * 100).toFixed(1) + "%";
const cents = (p) => Math.round(p * 100) + "\u00A2";
function american(p) {
  if (p <= 0 || p >= 1) return "—";
  return p >= 0.5
    ? "-" + Math.round((100 * p) / (1 - p))
    : "+" + Math.round((100 * (1 - p)) / p);
}
const fmtVol = (v) =>
  v >= 1e6
    ? (v / 1e6).toFixed(1) + "M"
    : v >= 1e3
    ? (v / 1e3).toFixed(0) + "K"
    : String(v);

function Gauge({ k, p }) {
  const lo = Math.min(k, p) * 100,
    hi = Math.max(k, p) * 100;
  return (
    <div style={{ position: "relative", height: 26, marginTop: 10 }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 0,
          right: 0,
          height: 2,
          background: C.line,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 9,
          left: lo + "%",
          width: Math.max(hi - lo, 0.5) + "%",
          height: 8,
          background: C.edgeSoft,
          border: `1px solid ${C.edge}`,
          borderRadius: 4,
        }}
      />
      {[
        { v: k, c: C.kalshi },
        { v: p, c: C.poly },
      ].map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: 7,
            left: `calc(${d.v * 100}% - 6px)`,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: d.c,
            border: "2px solid #fff",
            boxShadow: "0 1px 3px rgba(18,38,58,.35)",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          top: -4,
          left: 0,
          fontSize: 9,
          color: C.inkSoft,
        }}
      >
        0%
      </div>
      <div
        style={{
          position: "absolute",
          top: -4,
          right: 0,
          fontSize: 9,
          color: C.inkSoft,
        }}
      >
        100%
      </div>
    </div>
  );
}

function Spark({ points }) {
  if (!points || points.length < 2) return null;
  const W = 220,
    H = 34;
  const gaps = points.map((d) => d.gap);
  const max = Math.max(...gaps, 0.02);
  const path = points
    .map((d, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - (d.gap / max) * (H - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const first = gaps[0],
    last = gaps[gaps.length - 1];
  const dir =
    last > first * 1.15
      ? ["widening", C.edge]
      : last < first * 0.85
      ? ["converging", C.good]
      : ["stable", C.inkSoft];
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontSize: 10,
          fontFamily: "'IBM Plex Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: C.inkSoft,
          marginBottom: 2,
        }}
      >
        gap history · <span style={{ color: dir[1] }}>{dir[0]}</span> ·{" "}
        {points.length} pts
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Divergence trend: ${dir[0]}`}
      >
        <path d={path} fill="none" stroke={dir[1]} strokeWidth="1.5" />
      </svg>
    </div>
  );
}

function ConfTag({ v }) {
  const map = { high: C.good, medium: C.edge, low: "#B91C1C" };
  return (
    <span
      style={{
        fontSize: 10,
        fontFamily: "'IBM Plex Mono', monospace",
        textTransform: "uppercase",
        letterSpacing: ".08em",
        color: map[v] || C.inkSoft,
        border: `1px solid ${map[v] || C.line}`,
        borderRadius: 3,
        padding: "1px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {v} match
    </span>
  );
}

export default function Home() {
  const [phase, setPhase] = useState("idle");
  const [kalshi, setKalshi] = useState([]);
  const [poly, setPoly] = useState([]);
  const [matches, setMatches] = useState([]);
  const [note, setNote] = useState("");
  const [cat, setCat] = useState("economics");
  const [history, setHistory] = useState({});
  const [cached, setCached] = useState(false);

  const CATS = [
    ["economics", "Economics"],
    ["crypto", "Crypto"],
    ["politics", "Politics"],
    ["sports", "Sports"],
    ["all", "All"],
  ];

  async function scan() {
    setPhase("loading");
    setNote("");
    setMatches([]);
    try {
      const [kr, pr] = await Promise.all([
        fetch("/api/kalshi?category=" + cat),
        fetch("/api/polymarket?category=" + cat),
      ]);
      const kd = await kr.json();
      const pd = await pr.json();
      if (kd.error) throw new Error("Kalshi: " + kd.error);
      if (pd.error) throw new Error("Polymarket: " + pd.error);
      setKalshi(kd.markets || []);
      setPoly(pd.markets || []);
      setPhase("loaded");
    } catch (e) {
      setNote("Scan failed — " + (e.message || e));
      setPhase("idle");
    }
  }

  async function runMatch() {
    setPhase("matching");
    setNote("");
    try {
      const r = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kalshi, poly, category: cat }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      const found = d.matches || [];
      setMatches(found);
      setCached(!!d.cached);
      setPhase("done");

      // Divergence history (populated by the scheduled snapshot job).
      setHistory({});
      if (found.length) {
        try {
          const hr = await fetch("/api/history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pairs: found.map((m) => ({
                kalshi_id: m.kalshi_id,
                poly_id: m.poly_id,
              })),
            }),
          });
          const hd = await hr.json();
          setHistory(hd.series || {});
        } catch {
          // history is optional; the board still works without it
        }
      }
      if (!(d.matches || []).length)
        setNote(
          "No confident pairs found in " + kalshi.length + " Kalshi and " + poly.length + " Polymarket " + cat + " markets. Try another category, or rescan later — listings rotate through the day."
        );
    } catch (e) {
      setNote("Matching failed — " + (e.message || e));
      setPhase("loaded");
    }
  }

  const rows = useMemo(() => {
    const kMap = Object.fromEntries(kalshi.map((m) => [m.id, m]));
    const pMap = Object.fromEntries(poly.map((m) => [m.id, m]));
    return matches
      .map((m) => {
        const k = kMap[m.kalshi_id],
          p = pMap[m.poly_id];
        if (!k || !p) return null;
        const gap = Math.abs(k.prob - p.prob);
        const thin = Math.min(k.volume, p.volume);
        // Liquidity-aware score: a gap only counts as signal to the extent
        // the thinner side has real flow behind its quote.
        const weight = Math.min(1, Math.log10(1 + thin) / 5);
        return { ...m, k, p, gap, thin, score: gap * weight };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  }, [matches, kalshi, poly]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.paper,
        color: C.ink,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      <header
        style={{
          borderBottom: `2px solid ${C.ink}`,
          background: C.panel,
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              fontFamily: "'Archivo', sans-serif",
              fontStretch: "125%",
              fontWeight: 700,
              fontSize: 24,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            DIVERGENCE<span style={{ color: C.edge }}>DESK</span>
          </h1>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: C.inkSoft,
            }}
          >
            cross-venue event contract surveillance
          </span>
        </div>
        <div
          style={{
            maxWidth: 920,
            margin: "8px auto 0",
            display: "flex",
            gap: 16,
            fontSize: 12,
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          <span>
            <span
              style={{
                display: "inline-block",
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: C.kalshi,
                marginRight: 5,
              }}
            />
            Kalshi
          </span>
          <span>
            <span
              style={{
                display: "inline-block",
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: C.poly,
                marginRight: 5,
              }}
            />
            Polymarket
          </span>
        </div>
      </header>

      <main
        style={{ maxWidth: 920, margin: "0 auto", padding: "20px 16px 60px" }}
      >
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          {CATS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setCat(id)}
              disabled={phase === "loading" || phase === "matching"}
              style={{
                background: cat === id ? C.ink : C.panel,
                color: cat === id ? "#fff" : C.ink,
                border: `1px solid ${cat === id ? C.ink : C.line}`,
                borderRadius: 999,
                padding: "7px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <button
            onClick={scan}
            disabled={phase === "loading" || phase === "matching"}
            style={{
              background: C.ink,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {phase === "loading" ? "Scanning venues…" : "1 · Scan both venues"}
          </button>
          <button
            onClick={runMatch}
            disabled={
              !(phase === "loaded" || phase === "done") || phase === "matching"
            }
            style={{
              background:
                phase === "loaded" || phase === "done" ? C.edge : C.line,
              color:
                phase === "loaded" || phase === "done" ? "#fff" : C.inkSoft,
              border: "none",
              borderRadius: 6,
              padding: "12px 18px",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {phase === "matching"
              ? "Claude is pairing contracts…"
              : "2 · Match with AI"}
          </button>
        </div>

        {note && (
          <div
            style={{
              background: C.edgeSoft,
              border: `1px solid ${C.edge}`,
              borderRadius: 6,
              padding: "10px 12px",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {note}
          </div>
        )}

        {phase === "idle" && (
          <div
            style={{
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: 24,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <p style={{ marginTop: 0 }}>
              The same real-world event often trades at different implied
              probabilities on Kalshi and Polymarket. In listed options, a gap
              like that is either an arbitrage or a warning that the two
              contracts aren&apos;t actually the same instrument.
            </p>
            <p style={{ marginBottom: 0 }}>
              Scan pulls the top open markets by volume from both venues. Match
              sends the contract titles to Claude, which pairs equivalent
              outcomes and flags resolution-criteria differences before you
              read a price gap as edge.
            </p>
          </div>
        )}

        {(phase === "loaded" || phase === "matching") && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            {[
              { label: "Kalshi", data: kalshi, color: C.kalshi },
              { label: "Polymarket", data: poly, color: C.poly },
            ].map((v) => (
              <div
                key={v.label}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                  borderTop: `3px solid ${v.color}`,
                  borderRadius: 8,
                  padding: 12,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  {v.label} · {v.data.length} open markets
                </div>
                {v.data.slice(0, 8).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      fontSize: 12,
                      padding: "6px 0",
                      borderTop: `1px solid ${C.line}`,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.title}
                    </span>
                    <span
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {cents(m.prob)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {phase === "done" && (
          <>
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: C.inkSoft,
                margin: "4px 0 12px",
              }}
            >
              {rows.length} matched pairs · {cat} · {kalshi.length} kalshi / {poly.length} polymarket scanned{cached ? " · cached" : ""}
            </div>
            {rows.map((r, i) => (
              <article
                key={i}
                style={{
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      margin: 0,
                      lineHeight: 1.35,
                      flex: "1 1 220px",
                    }}
                  >
                    {r.k.title}
                  </h2>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 600,
                        fontSize: 20,
                        color: r.gap >= 0.04 ? C.edge : C.ink,
                      }}
                    >
                      {(r.gap * 100).toFixed(1)} pts
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.inkSoft,
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                      }}
                    >
                      divergence
                    </div>
                  </div>
                </div>

                <Gauge k={r.k.prob} p={r.p.prob} />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    marginTop: 12,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      borderLeft: `3px solid ${C.kalshi}`,
                      paddingLeft: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.inkSoft }}>KALSHI</div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {pct(r.k.prob)}
                    </div>
                    <div style={{ color: C.inkSoft }}>
                      {american(r.k.prob)} · vol {fmtVol(r.k.volume)}
                    </div>
                  </div>
                  <div
                    style={{
                      borderLeft: `3px solid ${C.poly}`,
                      paddingLeft: 8,
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.inkSoft }}>
                      POLYMARKET
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      {pct(r.p.prob)}
                    </div>
                    <div style={{ color: C.inkSoft }}>
                      {american(r.p.prob)} · vol {fmtVol(r.p.volume)}
                    </div>
                  </div>
                </div>

                <Spark points={history[`${r.kalshi_id}|${r.poly_id}`]} />

                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <ConfTag v={r.confidence} />
                  {r.thin < 50000 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "'IBM Plex Mono', monospace",
                        textTransform: "uppercase",
                        letterSpacing: ".08em",
                        color: C.edge,
                        border: `1px solid ${C.edge}`,
                        borderRadius: 3,
                        padding: "1px 6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      thin {fmtVol(r.thin)}
                    </span>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: C.ink,
                      flex: "1 1 200px",
                    }}
                  >
                    {r.note}
                    {r.thin < 50000 &&
                      " \u2014 Low volume on one side; this gap may reflect a stale quote rather than real disagreement."}
                  </p>
                </div>
              </article>
            ))}

            <section
              style={{
                marginTop: 24,
                borderTop: `2px solid ${C.ink}`,
                paddingTop: 14,
              }}
            >
              <h3
                style={{
                  fontFamily: "'Archivo', sans-serif",
                  fontStretch: "125%",
                  fontSize: 14,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  margin: "0 0 10px",
                }}
              >
                The options lens
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 10,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                }}
              >
                {[
                  [
                    "Price = implied probability",
                    "A 63\u00A2 Yes is the market saying 63% — the same read as backing delta out of an option price.",
                  ],
                  [
                    "Divergence \u2248 parity violation",
                    "Two prices for one outcome is put-call parity breaking. First question: are the contracts really identical?",
                  ],
                  [
                    "Resolution risk = contract specs",
                    "Different settlement rules across venues are different underlyings. The analyst notes exist to catch this.",
                  ],
                  [
                    "Exit before resolution",
                    "Selling before an event settles is closing a position early — no need to hold to 'expiration'.",
                  ],
                ].map(([t, d]) => (
                  <div
                    key={t}
                    style={{
                      background: C.panel,
                      border: `1px solid ${C.line}`,
                      borderRadius: 6,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{t}</div>
                    <div style={{ color: C.inkSoft }}>{d}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
