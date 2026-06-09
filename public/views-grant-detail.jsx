// Per-grant detail page (Requirements + Audit trail)
const { useState: useStateGD, useMemo: useMemoGD } = React;

function GrantDetailView({ grantId, onNav, onSetOrg }) {
  const { GRANTS, REQUIREMENTS, VAULT, AUDIT_LOG, GRANT_META, ORG_TEAM, DRAFTS, SESSIONS } = window.MOCK;
  const { fmtDate, fmtShortDate, daysUntil, matchClass, orgShort, orgName, relTime } = window.Helpers;
  const I = window.IconSet;

  const grant = GRANTS.find(g => g.id === grantId);
  if (!grant) return <div className="empty"><div className="title">Grant not found</div></div>;

  const reqs = REQUIREMENTS.filter(r => r.grant_id === grantId);
  const log = AUDIT_LOG.filter(l => l.grant_id === grantId).sort((a,b) => new Date(b.t) - new Date(a.t));
  const meta = GRANT_META[grantId] || {};
  const team = ORG_TEAM[grant.org_id] || [];
  const assignee = team.find(t => t.id === meta.assignee);
  const draft = DRAFTS.find(d => d.grant_id === grantId);
  const session = SESSIONS.find(s => s.grant_id === grantId);
  const d = daysUntil(grant.deadline);

  // Requirement readiness
  const docReqs = reqs.filter(r => r.kind === "doc");
  const docsReady = docReqs.filter(r => {
    if (!r.vault_id) return false;
    const v = VAULT.find(x => x.id === r.vault_id);
    return v?.status === "uploaded";
  }).length;
  const eligReqs = reqs.filter(r => r.kind === "eligible");
  const eligMet = eligReqs.filter(r => r.status === "met").length;
  const narrReqs = reqs.filter(r => r.kind === "narrative");
  const narrDone = narrReqs.filter(r => r.status === "drafted").length;
  const formReqs = reqs.filter(r => r.kind === "form");
  const formsDone = formReqs.filter(r => r.status === "drafted").length;

  const sections = [
    { key: "doc",       label: "Documents",     done: docsReady, total: docReqs.length, items: docReqs },
    { key: "eligible",  label: "Eligibility",   done: eligMet,   total: eligReqs.length, items: eligReqs },
    { key: "narrative", label: "Narrative",     done: narrDone,  total: narrReqs.length, items: narrReqs },
    { key: "form",      label: "Forms",         done: formsDone, total: formReqs.length, items: formReqs },
    { key: "signature", label: "Signatures",    done: 0,         total: reqs.filter(r => r.kind === "signature").length, items: reqs.filter(r => r.kind === "signature") },
  ].filter(s => s.total > 0);

  const totalDone = sections.reduce((a, s) => a + s.done, 0);
  const totalReq  = sections.reduce((a, s) => a + s.total, 0);
  const pct = totalReq ? Math.round((totalDone / totalReq) * 100) : 0;

  return (
    <div className="grant-detail">
      <div className="page-title">
        <div>
          <button className="back-link" onClick={() => onNav("pipeline")}>← Pipeline</button>
          <h1>{grant.name}</h1>
          <div className="sub">
            <span className="strong-link" onClick={() => onSetOrg && onSetOrg(grant.org_id)}>{orgName(grant.org_id)}</span>
            <span className="dot" /> {grant.funder} <span className="dot" /> {grant.amount}
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost btn-sm">Skip</button>
          <button className="btn btn-sm">Mark reviewing</button>
          <button className="btn btn-primary btn-sm">{draft ? "Open draft" : "Draft application"}</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="gd-kpis">
        <div className="kpi">
          <div className="lbl">Match score</div>
          <div className={"val match " + matchClass(grant.match_score)}>
            <span className="bar"><span className="fill" style={{width: grant.match_score + "%"}} /></span>
            {grant.match_score}%
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">Deadline</div>
          <div className="val">{fmtDate(grant.deadline)}</div>
          <div className={"sub2 " + (d <= 7 ? "danger" : d <= 14 ? "warn" : "")}>{d < 0 ? "passed" : d === 0 ? "today" : `in ${d} day${d===1?"":"s"}`}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Readiness</div>
          <div className="val">{totalDone}/{totalReq}</div>
          <div className="gauge"><div className="fill" style={{width: pct + "%", background: pct>=80?"var(--green)":pct>=50?"var(--yellow)":"var(--red)"}} /></div>
        </div>
        <div className="kpi">
          <div className="lbl">Assignee</div>
          <div className="val">{assignee?.name || "—"}</div>
          <div className="sub2">{assignee?.role || ""}</div>
        </div>
        <div className="kpi">
          <div className="lbl">Agent cost</div>
          <div className="val">{meta.agent_cost || "$0"}</div>
          <div className="sub2">{meta.agent_hours || 0}h</div>
        </div>
      </div>

      {/* Description + advantage strip */}
      <div className="card" style={{marginBottom: 14}}>
        <div className="gd-overview">
          <div>
            <h5>Description</h5>
            <p>{grant.description}</p>
          </div>
          <div>
            <h5>Cert advantage</h5>
            <p>{grant.advantage}</p>
            <h5 style={{marginTop:14}}>Source</h5>
            {grant.url ? (
              <p style={{fontSize:12.5, lineHeight:1.5, wordBreak:"break-all"}}>
                <a href={grant.url} target="_blank" rel="noopener noreferrer"
                   style={{color:"var(--accent, #f5a524)", textDecoration:"none"}}
                   title={grant.url}>
                  {window.Helpers.shortHost(grant.url)} ↗
                </a>
                {grant.source ? <span className="mono muted" style={{fontSize:11, marginLeft:8}}>via {grant.source}</span> : null}
              </p>
            ) : (
              <p className="mono" style={{fontSize:11.5}}>{grant.source || "—"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Requirements grid */}
      <div className="card">
        <div className="card-head">
          <h3>Requirements</h3>
          <span className="meta">{totalDone} of {totalReq} complete · {pct}% ready</span>
        </div>
        {sections.map(s => (
          <div key={s.key} className="req-section">
            <div className="req-head">
              <h5>{s.label}</h5>
              <span className="meta">{s.done}/{s.total}</span>
            </div>
            {s.items.map(r => <RequirementRow key={r.id} r={r} onNav={onNav} />)}
          </div>
        ))}
      </div>

      {/* Audit trail */}
      <div className="card" style={{marginTop: 14}}>
        <div className="card-head">
          <h3>Audit trail</h3>
          <span className="meta">{log.length} events</span>
        </div>
        <div className="audit-list">
          {log.map(e => (
            <div key={e.id} className="audit-row">
              <span className="when">{relTime(e.t)}</span>
              <span className={"actor " + (e.actor.startsWith("agent") ? "agent" : "human")}>{e.actor}</span>
              <span className={"action action-" + e.action}>{e.action.replace(/_/g," ")}</span>
              <span className="detail">{e.detail || ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequirementRow({ r, onNav }) {
  const { VAULT } = window.MOCK;
  const I = window.IconSet;

  let status = "pending", statusLabel = "pending", action = null;
  if (r.kind === "doc") {
    const v = r.vault_id ? VAULT.find(x => x.id === r.vault_id) : null;
    if (v?.status === "uploaded") { status = "ready"; statusLabel = "ready"; }
    else { status = "missing"; statusLabel = r.required ? "missing" : "optional"; }
    action = (status === "missing")
      ? <button className="btn btn-primary btn-sm" onClick={() => onNav("vault")}>Upload</button>
      : <button className="btn btn-ghost btn-sm" onClick={() => onNav("vault")}>View</button>;
  } else if (r.kind === "eligible") {
    if (r.status === "met")     { status = "ready"; statusLabel = "met"; }
    else if (r.status === "partial") { status = "warn"; statusLabel = "partial"; }
    else                        { status = "missing"; statusLabel = "not met"; }
  } else if (r.kind === "narrative" || r.kind === "form") {
    if (r.status === "drafted")   { status = "ready"; statusLabel = "drafted"; }
    else if (r.status === "in_progress") { status = "warn"; statusLabel = "in progress"; }
    else { status = "pending"; statusLabel = "pending"; }
    action = <button className="btn btn-ghost btn-sm" onClick={() => onNav("drafts")}>Open</button>;
  } else if (r.kind === "signature") {
    statusLabel = r.status || "pending";
    status = r.status === "signed" ? "ready" : "warn";
  }

  return (
    <div className="req-row">
      <span className={"req-dot " + status} />
      <div className="info">
        <div className="name">
          {r.label}
          {!r.required && r.kind === "doc" && <span className="opt-tag">optional</span>}
          {r.scoring_bonus && <span className="bonus-tag">{r.scoring_bonus}</span>}
        </div>
        {(r.detail || r.missing_reason) && <div className="desc">{r.detail || r.missing_reason}</div>}
        {r.word_target && <div className="desc">target {r.word_target.toLocaleString()} words</div>}
      </div>
      <span className={"req-status " + status}>{statusLabel}</span>
      <div className="actions">{action}</div>
    </div>
  );
}

window.GrantDetailView = GrantDetailView;
