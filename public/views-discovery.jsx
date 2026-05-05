// Calendar (Deadline timeline) + Sources status + Watchlists + Dismissed views
const { useState: useStateD, useMemo: useMemoD } = React;

function CalendarView({ orgFilter, onNav }) {
  const { GRANTS, SUBMISSIONS, FUNDERS } = window.MOCK;
  const { daysUntil, fmtShortDate, matchClass, orgShort } = window.Helpers;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const upcoming = GRANTS.filter(g => inOrg(g.org_id) && g.status !== "rejected" && daysUntil(g.deadline) >= -7)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  // Build a 90-day timeline starting today
  const today = new Date("2026-05-04T00:00:00Z");
  const days = 90;
  const weeks = Math.ceil(days / 7);

  const dayCol = (iso) => {
    const dt = new Date(iso);
    const diff = Math.round((dt - today) / 86400000);
    return diff;
  };

  // Group by week
  const weekRows = Array.from({length: weeks}, (_, w) => {
    const start = new Date(today.getTime() + w * 7 * 86400000);
    return { label: start.toLocaleDateString("en-US",{month:"short",day:"numeric"}), startDay: w * 7 };
  });

  const list = upcoming.filter(g => {
    const d = dayCol(g.deadline);
    return d >= -7 && d <= days;
  });

  // KPIs
  const kpis = {
    next7: list.filter(g => daysUntil(g.deadline) <= 7 && daysUntil(g.deadline) >= 0).length,
    next30: list.filter(g => daysUntil(g.deadline) <= 30 && daysUntil(g.deadline) >= 0).length,
    next90: list.length,
    totalAmt: list.reduce((sum, g) => sum + (parseInt(g.amount.replace(/\D/g,""))||0), 0),
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Deadline Calendar</h1>
          <div className="sub">{list.length} upcoming · timeline view</div>
        </div>
      </div>

      <div className="cal-kpis">
        <div className="kpi"><div className="lbl">Next 7 days</div><div className="val danger">{kpis.next7}</div></div>
        <div className="kpi"><div className="lbl">Next 30 days</div><div className="val warn">{kpis.next30}</div></div>
        <div className="kpi"><div className="lbl">Next 90 days</div><div className="val">{kpis.next90}</div></div>
        <div className="kpi"><div className="lbl">Total opportunity</div><div className="val">${(kpis.totalAmt/1000).toFixed(0)}k</div></div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Next 90 days</h3><span className="meta">starting today, May 4</span></div>
        <div className="timeline">
          <div className="tl-axis">
            {weekRows.map((w, i) => <div key={i} className="tl-week">{w.label}</div>)}
          </div>
          <div className="tl-rows">
            {list.map(g => {
              const dCol = dayCol(g.deadline);
              const draftStart = Math.max(0, dCol - 14); // 2-week prep window
              const widthPct = ((dCol - draftStart) / days) * 100;
              const leftPct = (draftStart / days) * 100;
              const dotPct = (dCol / days) * 100;
              const dToday = daysUntil(g.deadline);
              return (
                <div key={g.id} className="tl-row" onClick={() => onNav("grant", { grantId: g.id })}>
                  <div className="tl-label">
                    <span className={"match-dot " + matchClass(g.match_score)} />
                    <span className="name">{g.name}</span>
                    <span className="meta">{orgShort(g.org_id)} · {g.amount}</span>
                  </div>
                  <div className="tl-track">
                    <div className="tl-band" style={{left: leftPct + "%", width: widthPct + "%"}} title="Recommended prep window" />
                    <div className={"tl-dot " + (dToday < 7 ? "danger" : dToday < 14 ? "warn" : "")} style={{left: dotPct + "%"}}>
                      <div className="tip">{fmtShortDate(g.deadline)} · in {dToday}d</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourcesView({ orgFilter }) {
  const { SOURCES } = window.MOCK;
  const { relTime, orgShort } = window.Helpers;
  const I = window.IconSet;

  const list = SOURCES.filter(s => orgFilter === "all" || s.org_relevance.includes(orgFilter) || s.org_relevance.includes("all"));
  const byHealth = {
    ok: list.filter(s => s.health === "ok").length,
    warn: list.filter(s => s.health === "warn").length,
    stale: list.filter(s => s.health === "stale").length,
  };
  const itemsToday = list.reduce((a, s) => a + s.items_24h, 0);
  const keptToday = list.reduce((a, s) => a + s.kept, 0);

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Sources</h1>
          <div className="sub">{list.length} feeds monitored · {itemsToday} items in 24h, {keptToday} kept</div>
        </div>
        <div className="actions">
          <button className="btn"><span>{I.refresh}</span> Run all now</button>
          <button className="btn btn-primary btn-sm">Add source</button>
        </div>
      </div>

      <div className="cal-kpis">
        <div className="kpi"><div className="lbl">Healthy</div><div className="val" style={{color:"var(--green)"}}>{byHealth.ok}</div></div>
        <div className="kpi"><div className="lbl">Warning</div><div className="val warn">{byHealth.warn}</div></div>
        <div className="kpi"><div className="lbl">Stale</div><div className="val danger">{byHealth.stale}</div></div>
        <div className="kpi"><div className="lbl">Yield rate</div><div className="val">{itemsToday ? Math.round((keptToday/itemsToday)*100) : 0}%</div></div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Source</th>
              <th style={{width:140}}>Type</th>
              <th>Coverage</th>
              <th style={{width:100}}>Health</th>
              <th style={{width:120}}>24h items</th>
              <th style={{width:140}}>Last run</th>
              <th style={{width:100}}>Cron</th>
              <th style={{width:80}} />
            </tr>
          </thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id} style={{cursor:"default"}}>
                <td className="strong">
                  {s.name}
                  {s.note && <div className="muted" style={{fontSize:11, marginTop:2, color:"var(--yellow)"}}>{s.note}</div>}
                </td>
                <td className="muted" style={{fontSize:11.5}}>{s.type}</td>
                <td className="muted" style={{fontSize:11.5}}>{s.coverage}</td>
                <td>
                  <span className={"pill pill-" + (s.health === "ok" ? "ready" : s.health === "warn" ? "warn" : "low")}>{s.health}</span>
                </td>
                <td>
                  <div style={{fontSize:11.5}}>
                    <span className="num">{s.items_24h}</span> seen
                    <span className="muted"> · </span>
                    <span className="num" style={{color:"var(--accent)"}}>{s.kept}</span> kept
                  </div>
                </td>
                <td className="muted mono" style={{fontSize:11}}>{relTime(s.last_run)}</td>
                <td className="muted mono" style={{fontSize:11}}>{s.cron}</td>
                <td className="right-actions"><button className="btn btn-ghost btn-sm">Run</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WatchlistsView({ orgFilter, onNav }) {
  const { WATCHLISTS } = window.MOCK;
  const { orgShort } = window.Helpers;
  const I = window.IconSet;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const list = WATCHLISTS.filter(w => inOrg(w.org_id));

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Watchlists</h1>
          <div className="sub">{list.filter(w=>w.active).length} active · standing searches re-run with every discovery cron</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-sm">+ New watchlist</button>
        </div>
      </div>

      <div className="watch-grid">
        {list.map(w => (
          <div key={w.id} className={"watch-card " + (w.active ? "" : "paused")}>
            <div className="head">
              <div>
                <div className="name">{w.name}</div>
                <div className="meta">{orgShort(w.org_id)}</div>
              </div>
              <span className={"pill pill-" + (w.active ? "ready" : "low")}>{w.active ? "active" : "paused"}</span>
            </div>
            <div className="query">
              <span className="lbl">Query</span>
              <code>{w.query}</code>
            </div>
            <div className="stats">
              <div><span className="num accent">{w.new_24h}</span><span className="lbl">new 24h</span></div>
              <div><span className="num">{w.total_lifetime}</span><span className="lbl">lifetime</span></div>
            </div>
            <div className="actions">
              <button className="btn btn-ghost btn-sm">Edit</button>
              <button className="btn btn-ghost btn-sm">{w.active ? "Pause" : "Resume"}</button>
              <button className="btn btn-sm">View matches</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DismissedView({ orgFilter }) {
  const { DISMISSED } = window.MOCK;
  const { fmtDate, orgShort } = window.Helpers;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const list = DISMISSED.filter(d => inOrg(d.org_id));

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Dismissed</h1>
          <div className="sub">{list.length} grant{list.length===1?"":"s"} skipped — agents won't re-surface these</div>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead><tr><th>Grant</th><th style={{width:140}}>Funder</th><th style={{width:110}}>Org</th><th style={{width:110}}>Amount</th><th>Reason</th><th style={{width:100}}>Dismissed</th><th style={{width:100}}>By</th><th style={{width:80}} /></tr></thead>
          <tbody>
            {list.map(d => (
              <tr key={d.id} style={{cursor:"default"}}>
                <td className="strong">{d.name}</td>
                <td className="muted" style={{fontSize:11.5}}>{d.funder}</td>
                <td className="muted" style={{fontSize:11.5}}>{orgShort(d.org_id)}</td>
                <td className="num">{d.amount}</td>
                <td className="muted" style={{fontSize:11.5}}>{d.reason}</td>
                <td className="muted mono" style={{fontSize:11}}>{fmtDate(d.dismissed_at)}</td>
                <td className="muted" style={{fontSize:11.5}}>{d.dismissed_by}</td>
                <td className="right-actions"><button className="btn btn-ghost btn-sm">Restore</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.CalendarView = CalendarView;
window.SourcesView = SourcesView;
window.WatchlistsView = WatchlistsView;
window.DismissedView = DismissedView;
