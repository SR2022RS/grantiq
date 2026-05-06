// Inbox + Pipeline views
const { useState, useMemo } = React;

function InboxView({ orgFilter, onNav }) {
  const { GRANTS, DRAFTS, SESSIONS, ALERTS } = window.MOCK;
  const { relTime, daysUntil, matchClass, orgShort } = window.Helpers;
  const I = window.IconSet;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;

  const gated   = SESSIONS.filter(s => s.status === "gated" && inOrg(s.org_id));
  const ready   = DRAFTS.filter(d => d.status === "ready_for_review" && inOrg(d.org_id));
  const unread  = ALERTS.filter(a => a.severity !== "info" || true).slice(0, 3);
  const today   = GRANTS.filter(g => g.match_score >= 80 && g.status === "new" && inOrg(g.org_id));
  const urgent  = GRANTS.filter(g => {
    const d = daysUntil(g.deadline);
    return d >= 0 && d <= 14 && g.status !== "rejected" && inOrg(g.org_id);
  }).sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline));

  const totalItems = gated.length + ready.length + today.length + urgent.length;

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Inbox</h1>
          <div className="sub">{totalItems === 0 ? "All caught up." : `${totalItems} item${totalItems === 1 ? "" : "s"} need attention`} · last discovery cron <span className="mono">07:00 EST</span></div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost"><span>{I.refresh}</span> Refresh</button>
          <button className="btn"><span>{I.search}</span> Run discovery now</button>
        </div>
      </div>

      {gated.length > 0 && (
        <div className="inbox-section">
          <div className="head">
            <h2>Needs your approval</h2>
            <span className="count">{gated.length}</span>
            <div className="strip" />
          </div>
          {gated.map(s => {
            const grant = GRANTS.find(g => g.id === s.grant_id);
            return (
              <div key={s.id} className="inbox-card urgent">
                <div className="ic">{I.alert}</div>
                <div className="body">
                  <div className="title">Playwright gated on {grant?.name}</div>
                  <div className="desc">{s.reason}</div>
                  <div className="meta">
                    <span>{orgShort(s.org_id)}</span><span className="dot" />
                    <span>step {s.step}/{s.total}</span><span className="dot" />
                    <span>{s.screenshots} screenshots</span><span className="dot" />
                    <span>{relTime(s.started)}</span>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => onNav("sessions", { sessionId: s.id })}>Review</button>
                  <button className="btn btn-primary btn-sm" onClick={() => onNav("sessions", { sessionId: s.id })}>Approve & Resume</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ready.length > 0 && (
        <div className="inbox-section">
          <div className="head">
            <h2>Drafts ready for review</h2>
            <span className="count">{ready.length}</span>
            <div className="strip" />
          </div>
          {ready.map(d => (
            <div key={d.id} className="inbox-card attention">
              <div className="ic">{I.drafts}</div>
              <div className="body">
                <div className="title">{d.grant_name}</div>
                <div className="desc">{d.summary}</div>
                <div className="meta">
                  <span>{orgShort(d.org_id)}</span><span className="dot" />
                  <span>{d.word_count.toLocaleString()} words</span><span className="dot" />
                  <span>{d.sections} sections</span><span className="dot" />
                  <span>updated {relTime(d.updated)}</span>
                </div>
              </div>
              <div className="actions">
                <button className="btn btn-primary btn-sm" onClick={() => onNav("drafts", { draftId: d.id })}>Review</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {today.length > 0 && (
        <div className="inbox-section">
          <div className="head">
            <h2>Today's high-match discoveries</h2>
            <span className="count">{today.length}</span>
            <div className="strip" />
          </div>
          {today.slice(0, 4).map(g => (
            <div key={g.id} className="inbox-card">
              <div className="ic">{I.spark}</div>
              <div className="body">
                <div className="title">{g.name}</div>
                <div className="desc">{g.funder} · {g.amount} · advantage: {g.advantage}</div>
                <div className="meta">
                  <span>{orgShort(g.org_id)}</span><span className="dot" />
                  <span>match {g.match_score}%</span><span className="dot" />
                  <span>due {new Date(g.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                </div>
              </div>
              <div className="actions">
                <span className={`match ${matchClass(g.match_score)}`}>
                  <span className="bar"><span className="fill" style={{width: g.match_score + "%"}} /></span>
                  {g.match_score}%
                </span>
                <button className="btn btn-sm" onClick={() => onNav("pipeline", { grantId: g.id })}>Review</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {urgent.length > 0 && (
        <div className="inbox-section">
          <div className="head">
            <h2>Urgent deadlines (next 14 days)</h2>
            <span className="count">{urgent.length}</span>
            <div className="strip" />
          </div>
          {urgent.map(g => {
            const d = daysUntil(g.deadline);
            return (
              <div key={g.id} className={"inbox-card " + (d <= 7 ? "urgent" : "")}>
                <div className="ic">{I.clock}</div>
                <div className="body">
                  <div className="title">{g.name} <span className="muted" style={{fontWeight:400, fontSize:11.5}}>· due in {d} day{d===1?"":"s"}</span></div>
                  <div className="desc">{g.funder} · {g.amount} · {g.docs_ready}/{g.docs_total} docs ready</div>
                  <div className="meta">
                    <span>{orgShort(g.org_id)}</span><span className="dot" />
                    <span>match {g.match_score}%</span><span className="dot" />
                    <span className={"pill pill-" + g.status}>{g.status}</span>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn btn-primary btn-sm" onClick={() => onNav("pipeline", { grantId: g.id })}>Open</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalItems === 0 && (
        <div className="empty">
          <div className="icon">✓</div>
          <div className="title">All caught up</div>
          <div className="sub">Next discovery cron: 7:00 AM EST tomorrow.</div>
        </div>
      )}
    </div>
  );
}

function PipelineView({ orgFilter, focusGrantId, onNav }) {
  const [showAddGrant, setShowAddGrant] = React.useState(false);
  const { GRANTS } = window.MOCK;
  const { matchClass, fmtShortDate, daysUntil, orgShort } = window.Helpers;
  const I = window.IconSet;

  const [status, setStatus]   = useState("active"); // active | new | drafting | submitted | rejected | all
  const [minMatch, setMin]    = useState(50);
  const [search, setSearch]   = useState("");
  const [expand, setExpand]   = useState(focusGrantId || null);
  const [sort, setSort]       = useState("match");

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;

  const list = useMemo(() => {
    let r = GRANTS.filter(g => inOrg(g.org_id));
    r = r.filter(g => g.match_score >= minMatch);
    if (status === "active")    r = r.filter(g => ["new","reviewing","drafting"].includes(g.status));
    else if (status !== "all")  r = r.filter(g => g.status === status);
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter(g => g.name.toLowerCase().includes(s) || g.funder.toLowerCase().includes(s));
    }
    if (sort === "match")    r.sort((a,b) => b.match_score - a.match_score);
    if (sort === "deadline") r.sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
    if (sort === "amount")   r.sort((a,b) => parseInt(b.amount.replace(/\D/g,""))||0 - parseInt(a.amount.replace(/\D/g,""))||0);
    return r;
  }, [orgFilter, status, minMatch, search, sort]);

  const statusChips = [
    ["active","Active"], ["new","New"], ["drafting","Drafting"], ["submitted","Submitted"], ["rejected","Rejected"], ["all","All"]
  ];

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Pipeline</h1>
          <div className="sub">{list.length} grant{list.length===1?"":"s"} matching filters · sorted by {sort}</div>
        </div>
        <div className="actions">
          <button className="btn"><span>{I.search}</span> Run discovery</button>
          <button className="btn btn-primary" onClick={() => setShowAddGrant(true)}>+ Add grant</button>
        </div>
      </div>

      {showAddGrant && (
        <window.AddGrantModal
          defaultOrgId={orgFilter}
          onClose={() => setShowAddGrant(false)}
          onCreated={(j) => {
            setShowAddGrant(false);
            // Refresh live data so the new grant appears
            if (window.loadLiveData) {
              window.loadLiveData().then(live => Object.assign(window.MOCK, live)).catch(() => {});
            }
          }}
        />
      )}

      <div className="filterbar">
        <div className="group">
          <label>Status</label>
          {statusChips.map(([k,l]) => (
            <button key={k} className={"chip " + (status === k ? "active" : "")} onClick={() => setStatus(k)}>{l}</button>
          ))}
        </div>
        <div className="group">
          <label>Sort</label>
          <button className={"chip " + (sort === "match" ? "active" : "")} onClick={() => setSort("match")}>Match</button>
          <button className={"chip " + (sort === "deadline" ? "active" : "")} onClick={() => setSort("deadline")}>Deadline</button>
        </div>
        <div className="slider-wrap">
          <span>Min match</span>
          <input type="range" min="0" max="100" step="5" value={minMatch} onChange={e => setMin(+e.target.value)} />
          <span>{minMatch}%</span>
        </div>
        <input className="search-input" placeholder="Search grant or funder…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width: 130}}>Match</th>
              <th>Grant</th>
              <th style={{width: 110}}>Org</th>
              <th style={{width: 100}}>Amount</th>
              <th style={{width: 110}}>Deadline</th>
              <th style={{width: 100}}>Docs</th>
              <th style={{width: 110}}>Status</th>
              <th style={{width: 80}} />
            </tr>
          </thead>
          <tbody>
            {list.map(g => {
              const d = daysUntil(g.deadline);
              const docPct = Math.round((g.docs_ready / g.docs_total) * 100);
              const open = expand === g.id;
              return (
                <React.Fragment key={g.id}>
                  <tr className={open ? "expanded" : ""} onClick={() => setExpand(open ? null : g.id)}>
                    <td>
                      <span className={`match ${matchClass(g.match_score)}`}>
                        <span className="bar"><span className="fill" style={{width: g.match_score + "%"}} /></span>
                        {g.match_score}%
                      </span>
                    </td>
                    <td className="strong">
                      {g.name}
                      <div className="muted" style={{fontSize:11, marginTop:2}}>{g.funder}</div>
                    </td>
                    <td className="muted" style={{fontSize:11.5}}>{orgShort(g.org_id)}</td>
                    <td className="num">{g.amount}</td>
                    <td className="num">
                      {fmtShortDate(g.deadline)}
                      <div className="muted" style={{fontSize:10.5, marginTop:1}}>
                        {d < 0 ? "passed" : d === 0 ? "today" : `in ${d}d`}
                      </div>
                    </td>
                    <td>
                      <div style={{display:"flex", alignItems:"center", gap:6, fontSize:11}}>
                        <span className="num">{g.docs_ready}/{g.docs_total}</span>
                        <span className="match" style={{gap:0}}>
                          <span className="bar" style={{width:40}}>
                            <span className="fill" style={{width: docPct + "%", background: docPct>=80?"var(--green)":docPct>=50?"var(--yellow)":"var(--red)"}} />
                          </span>
                        </span>
                      </div>
                    </td>
                    <td><span className={"pill pill-" + g.status}>{g.status}</span></td>
                    <td className="right-actions">
                      <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onNav("drafts"); }}>{open ? "Close" : "Open"}</button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="expand-row">
                      <td colSpan="8">
                        <div className="inner">
                          <div>
                            <h5>Description</h5>
                            <p>{g.description}</p>
                            <h5 style={{marginTop:14}}>Eligibility</h5>
                            <p>{g.eligibility.join(" · ")}</p>
                          </div>
                          <div>
                            <h5>Certification advantage</h5>
                            <p>{g.advantage}</p>
                            <h5 style={{marginTop:14}}>Source</h5>
                            <p className="mono" style={{fontSize:11.5}}>{g.source}</p>
                            <div style={{display:"flex", gap:8, marginTop:14}}>
                              <button className="btn btn-primary btn-sm">Draft application</button>
                              <button className="btn btn-sm">Mark reviewing</button>
                              <button className="btn btn-ghost btn-sm">Skip</button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan="8"><div className="empty"><div className="title">No grants match these filters</div><div className="sub">Lower the match threshold or change status filter.</div></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.InboxView = InboxView;
window.PipelineView = PipelineView;
