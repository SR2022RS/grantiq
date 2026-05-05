// Drafts, Sessions, Vault views
const { useState: useState2, useMemo: useMemo2 } = React;

function DraftsView({ orgFilter, focusDraftId, onNav }) {
  const { DRAFTS, GRANTS } = window.MOCK;
  const { relTime, orgShort } = window.Helpers;
  const I = window.IconSet;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const list = DRAFTS.filter(d => inOrg(d.org_id));

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Drafts</h1>
          <div className="sub">{list.length} draft{list.length===1?"":"s"} · {list.filter(d=>d.status==="ready_for_review").length} ready for review</div>
        </div>
        <div className="actions">
          <button className="btn"><span>{I.refresh}</span> Sync from agent</button>
        </div>
      </div>

      {list.map(d => {
        const grant = GRANTS.find(g => g.id === d.grant_id);
        const isReady = d.status === "ready_for_review";
        return (
          <div key={d.id} className="draft-card" style={focusDraftId === d.id ? {borderColor:"var(--accent)"} : null}>
            <div>
              <div style={{display:"flex", gap:8, alignItems:"center"}}>
                <span className="title">{d.grant_name}</span>
                <span className={"pill pill-" + (isReady ? "ready" : "drafting")}>{isReady ? "ready" : "drafting"}</span>
              </div>
              <div className="org-line">{orgShort(d.org_id)} · {grant?.amount} · due {grant ? new Date(grant.deadline).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—"}</div>
              <div className="summary">{d.summary}</div>
              <div className="meta">
                <span>{d.word_count.toLocaleString()} words</span>
                <span>{d.sections} sections</span>
                <span>updated {relTime(d.updated)}</span>
              </div>
              <div style={{fontSize:11.5, color:"var(--text-3)", marginTop:6}}><strong style={{color:"var(--text-2)", fontWeight:500}}>Next:</strong> {d.next}</div>
            </div>
            <div className="actions">
              {isReady ? (
                <>
                  <button className="btn btn-primary btn-sm">Review narrative</button>
                  <button className="btn btn-sm" onClick={() => onNav("sessions")}>Submit via Playwright</button>
                  <button className="btn btn-ghost btn-sm">Download .docx</button>
                </>
              ) : (
                <>
                  <button className="btn btn-sm">Open partial</button>
                  <button className="btn btn-ghost btn-sm">Cancel draft</button>
                </>
              )}
            </div>
          </div>
        );
      })}

      {list.length === 0 && (
        <div className="empty">
          <div className="icon">✎</div>
          <div className="title">No drafts yet</div>
          <div className="sub">Open the Pipeline and start a draft from any grant.</div>
        </div>
      )}
    </div>
  );
}

function SessionsView({ orgFilter, focusSessionId }) {
  const { SESSIONS, GRANTS } = window.MOCK;
  const { relTime, orgShort } = window.Helpers;
  const I = window.IconSet;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const list = SESSIONS.filter(s => inOrg(s.org_id));
  const initial = focusSessionId || list.find(s => s.status === "gated")?.id || list[0]?.id;
  const [selected, setSelected] = useState2(initial);
  const [resuming, setResuming] = useState2(null); // session_id being resumed
  const session = list.find(s => s.id === selected);
  const grant = session ? GRANTS.find(g => g.id === session.grant_id) : null;

  async function resumeSession(sessionId, action) {
    if (!sessionId || resuming) return;
    setResuming(sessionId);
    try {
      const r = await fetch("/api/playwright/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, user_action: action || "approved" }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert("Resume failed: " + (j.error || r.status));
      } else {
        alert(j.message || "Session resumed. Refresh to see updated status.");
      }
    } catch (e) {
      alert("Network error: " + e.message);
    } finally {
      setResuming(null);
    }
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Sessions</h1>
          <div className="sub">{list.length} Playwright session{list.length===1?"":"s"} · {list.filter(s=>s.status==="gated").length} gated · {list.filter(s=>s.status==="in_progress").length} live</div>
        </div>
      </div>

      <div className="sessions-grid">
        <div className="sessions-list">
          {list.map(s => {
            const g = GRANTS.find(x => x.id === s.grant_id);
            return (
              <div key={s.id} className={"session-item " + (s.id === selected ? "active" : "")} onClick={() => setSelected(s.id)}>
                <div className="top">
                  <span className={"pill dot pill-" + s.status}>{s.status.replace("_"," ")}</span>
                  <span style={{fontSize:10.5, color:"var(--text-4)", fontFamily:"var(--font-mono)"}}>{relTime(s.started)}</span>
                </div>
                <div style={{fontSize:12, fontWeight:500, marginBottom:2}}>{g?.name}</div>
                <div className="url">{s.url}</div>
                <div className="meta">
                  <span>{orgShort(s.org_id)}</span>
                  <span>step {s.step}{s.total ? `/${s.total}` : ""}</span>
                  <span>{s.screenshots} shots</span>
                </div>
              </div>
            );
          })}
        </div>

        {session && (
          <div className="session-detail">
            <div className={"session-banner " + session.status}>
              <div className="left">
                <h3>{grant?.name || "Session"}</h3>
                <div className="url">{session.url}</div>
                <div style={{display:"flex", gap:10, marginTop:8, fontSize:11, color:"var(--text-3)", fontFamily:"var(--font-mono)"}}>
                  <span>{orgShort(session.org_id)}</span>
                  <span>started {relTime(session.started)}</span>
                  <span>{session.screenshots} screenshots</span>
                </div>
              </div>
              <div className="actions">
                {session.status === "gated" && (
                  <>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => resumeSession(session.id, "cancel")}
                      disabled={resuming === session.id}
                    >Cancel</button>
                    <button
                      className="btn btn-primary"
                      onClick={() => resumeSession(session.id, "approved")}
                      disabled={resuming === session.id}
                    >{resuming === session.id ? "Resuming…" : "Approve & Resume"}</button>
                  </>
                )}
                {session.status === "in_progress" && <button className="btn btn-sm">Pause</button>}
                {session.status === "failed" && <button className="btn btn-sm">Retry</button>}
                {session.status === "completed" && <button className="btn btn-sm">View receipt</button>}
              </div>
            </div>

            {session.status === "gated" && (
              <div style={{padding:"14px 18px", background:"var(--red-bg)", borderBottom:"1px solid var(--hairline)", fontSize:12.5, color:"var(--text)"}}>
                <strong style={{color:"var(--red)"}}>Gate reason:</strong> {session.reason}
              </div>
            )}
            {session.status === "failed" && (
              <div style={{padding:"14px 18px", background:"var(--red-bg)", borderBottom:"1px solid var(--hairline)", fontSize:12.5, color:"var(--text)"}}>
                <strong style={{color:"var(--red)"}}>Failure:</strong> {session.reason}
              </div>
            )}

            <div className="screenshot-grid">
              <h5>Screenshot timeline · {session.screenshots} captures</h5>
              <div className="screenshot-track">
                {Array.from({length: session.screenshots}).map((_, i) => {
                  const isCurrent = i === session.screenshots - 1;
                  return (
                    <div key={i} className={"shot " + (isCurrent ? "current" : "")}>
                      <div className="fake-page" />
                      <div className="step-num">step {i+1}</div>
                      {isCurrent && <div className="label">{session.last_screenshot_label}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="session-meta">
              <div className="item"><div className="l">Step</div><div className="v">{session.step}{session.total ? ` / ${session.total}` : ""}</div></div>
              <div className="item"><div className="l">Tokens used</div><div className="v">42,180</div></div>
              <div className="item"><div className="l">Latency p50</div><div className="v">1.2s</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Map doc_name → template_kind. Mirrors src/lib/document-catalog.js DOC_TYPE_METADATA.
// Keep in sync when new doc types are added.
const TEMPLATE_KIND_BY_NAME = {
  "Board of Directors / Leadership List": "draftable",
  "CV — Rodney Williams":                  "draftable",
  "CV — Yinessa Davis-Cacapit, RN, BSN":   "draftable",
  "Organizational Chart":                  "draftable",
  "W-9 Tax Form":                          "draftable",
  "Letter of Support — Community Partner": "draftable",
  "Letter of Support — Government / MCO":  "draftable",
  "Letter of Support — Government/MCO":    "draftable",
  "Letter of Support — Physician/Referral Partner": "draftable",
  "Letter of Support — Physician / Referral Partner": "draftable",
  "Letter of Support — Government / Municipal Partner": "draftable",
  "Letter of Support — Subcontractor / Industry Partner": "draftable",
  "Capability Statement":                  "draftable",
  "IRS 508(c)(1)(a) Determination Letter": "request",
  "Medicare Certification":                "request",
  "SDVOSB Certification Letter (SBA)":     "request",
  "VOSB Certification Letter (SBA)":       "request",
  "Financial Statements (P&L, Balance Sheet)": "request",
  "Bank Reference Letter":                 "request",
  "Indirect Cost Rate Agreement":          "request",
  "Business Tax Returns (Last 2 Years)":   "request",
  "Georgia DCH Home Health License":       "gather",
  "DE Home Health License":                "gather",
  "EVV Compliance Report (HHAeXchange)":   "gather",
  "SAM.gov Registration Verification":     "gather",
};

// Map vault doc_name → catalog doc_type. Some vault rows have human names that
// don't match the catalog keys directly.
const DOC_NAME_TO_TYPE = {
  "Board of Directors / Leadership List": "board_list",
  "CV — Rodney Williams":                  "cv_operations_lead",
  "CV — Yinessa Davis-Cacapit, RN, BSN":   "cv_clinical_director",
  "Organizational Chart":                  "org_chart",
  "W-9 Tax Form":                          "w9",
  "Letter of Support — Community Partner": "letter_of_support_community",
  "Letter of Support — Government / MCO":  "letter_of_support_government",
  "Letter of Support — Government/MCO":    "letter_of_support_government",
  "Letter of Support — Physician/Referral Partner": "letter_of_support_physician",
  "Letter of Support — Physician / Referral Partner": "letter_of_support_physician",
  "Letter of Support — Government / Municipal Partner": "letter_of_support_government",
  "Letter of Support — Subcontractor / Industry Partner": "letter_of_support_community",
  "Letter of Support — Past Performance Reference":      "letter_of_support_physician",
  "Capability Statement":                  "capability_statement",
  "Capability Statement (1-page)":         "capability_statement",
  "CV — Operations Lead":                  "cv_operations_lead",
};

function templateKindFor(doc) {
  return TEMPLATE_KIND_BY_NAME[doc.doc_name] || null;
}

function VaultView({ orgFilter, onSetOrg, onNav }) {
  const { VAULT, ORGS, REQUIREMENTS, GRANTS } = window.MOCK;
  const { fmtDate, daysUntil, readinessClass, readinessColor } = window.Helpers;
  const I = window.IconSet;
  const [draftingId, setDraftingId] = React.useState(null);
  const [generatingPack, setGeneratingPack] = React.useState(false);
  const [draftPreview, setDraftPreview] = React.useState(null); // {doc_name, content}

  // Vault is org-specific — if "all", default to k1 (most active per PRD)
  const activeOrgId = orgFilter === "all" ? "k1_management" : orgFilter;
  const org = ORGS.find(o => o.id === activeOrgId);
  const docs = VAULT.filter(v => v.org_id === activeOrgId);

  async function draftDocument(doc) {
    const docType = DOC_NAME_TO_TYPE[doc.doc_name];
    if (!docType) {
      alert("This document doesn't have an AI template yet. (Add one at workspace/templates/" + activeOrgId + "/<doc_type>.md)");
      return;
    }
    setDraftingId(doc.id);
    try {
      const r = await fetch('/api/orgs/draft-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: activeOrgId, doc_type: docType }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert("Draft failed: " + (j.error || r.status));
      } else {
        setDraftPreview({ doc_name: doc.doc_name, content: j.draft_content || '', kind: j.template_kind });
      }
    } catch (e) {
      alert("Network error: " + e.message);
    } finally {
      setDraftingId(null);
    }
  }

  function downloadReadinessPack() {
    setGeneratingPack(true);
    const url = `/api/orgs/readiness-pack?org_id=${encodeURIComponent(activeOrgId)}`;
    // Trigger download via hidden link
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setGeneratingPack(false), 1500);
  }

  function downloadDraftAsFile() {
    if (!draftPreview) return;
    const blob = new Blob([draftPreview.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = draftPreview.doc_name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Compute fan-out: how many active grants does each doc unblock?
  const grantsForOrg = GRANTS.filter(g => g.org_id === activeOrgId && ["new","reviewing","drafting"].includes(g.status));
  const docFanOut = (vaultId) => {
    const blockedGrants = grantsForOrg.filter(g => {
      const reqs = REQUIREMENTS.filter(r => r.grant_id === g.id && r.kind === "doc" && r.required && r.vault_id === vaultId);
      return reqs.length > 0;
    });
    return blockedGrants;
  };

  const uploaded = docs.filter(d => d.status === "uploaded").length;
  const total = docs.length;
  const pct = total ? Math.round((uploaded / total) * 100) : 0;

  // Top blockers: missing docs that block multiple grants
  const blockers = docs
    .filter(d => d.status === "missing")
    .map(d => ({ doc: d, grants: docFanOut(d.id) }))
    .filter(b => b.grants.length > 0)
    .sort((a, b) => b.grants.length - a.grants.length);

  // Expiring soon
  const expiringSoon = docs.filter(d => d.status === "uploaded" && d.expires && daysUntil(d.expires) > 0 && daysUntil(d.expires) < 90);

  const groups = [
    { key: "all",     label: "Required for all grants" },
    { key: "federal", label: "Federal grants (HRSA, SBA, MBDA, VA)" },
    { key: "state",   label: "State grants (PA, NJ, DE)" },
  ];

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Document Vault</h1>
          <div className="sub">Per-org grant readiness · pulled from Supabase Storage</div>
        </div>
        <div className="actions">
          <div className="org-switcher">
            {ORGS.filter(o => o.id !== "all").map(o => (
              <button key={o.id} className={o.id === activeOrgId ? "active" : ""} onClick={() => onSetOrg(o.id)}>{o.short}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={downloadReadinessPack} disabled={generatingPack}>
            <span>{I.spark}</span> {generatingPack ? "Building…" : "Generate Readiness Pack"}
          </button>
          <button className="btn"><span>{I.upload}</span> Download all (ZIP)</button>
        </div>
      </div>

      <div className="vault-org-head">
        <div>
          <div className="org-name">{org?.name}</div>
          <div className="muted" style={{fontSize:11.5, marginTop:2}}>{uploaded} of {total} required documents on file · {total - uploaded} missing</div>
          <div className="certs">
            {(org?.certs || []).map(c => <span key={c} className="cert">{c}</span>)}
          </div>
        </div>
        <div className="readiness">
          <div className="lbl">Grant readiness</div>
          <div className={"num " + readinessClass(pct)}>{pct}%</div>
          <div className="gauge"><div className="fill" style={{width: pct + "%", background: readinessColor(pct)}} /></div>
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="card blockers">
          <div className="card-head">
            <h3>Top blockers — fix these first</h3>
            <span className="meta">{blockers.length} document{blockers.length===1?"":"s"} blocking active grants</span>
          </div>
          {blockers.map(({doc, grants}) => (
            <div key={doc.id} className="blocker-row">
              <div className="left">
                <div className="impact">
                  <span className="num">{grants.length}</span>
                  <span className="lbl">grant{grants.length===1?"":"s"}<br/>blocked</span>
                </div>
                <div>
                  <div className="name">{doc.doc_name}</div>
                  <div className="desc">{doc.description}</div>
                  <div className="grants-list">
                    {grants.map(g => (
                      <span key={g.id} className="grant-chip" onClick={() => onNav("grant", { grantId: g.id })}>
                        {g.name} <span className="meta">· {g.amount}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button className="btn btn-primary btn-sm">Upload</button>
            </div>
          ))}
        </div>
      )}

      {expiringSoon.length > 0 && (
        <div className="card" style={{marginBottom:14, borderColor:"var(--yellow-bg)"}}>
          <div className="card-head">
            <h3 style={{color:"var(--yellow)"}}>Expiring soon</h3>
            <span className="meta">{expiringSoon.length} certification{expiringSoon.length===1?"":"s"} expiring in 90 days</span>
          </div>
          {expiringSoon.map(d => (
            <div key={d.id} className="doc-row">
              <div className="ic uploaded">{I.check}</div>
              <div className="info">
                <div className="name">{d.doc_name}</div>
                <div className="desc">{d.description}</div>
                <div className="stamp warn">expires {fmtDate(d.expires)} · {daysUntil(d.expires)} days left</div>
              </div>
              <button className="btn btn-sm">Renew</button>
            </div>
          ))}
        </div>
      )}

      {draftPreview && (
        <div className="modal-overlay" onClick={() => setDraftPreview(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h3>{draftPreview.doc_name}</h3>
                <div className="muted" style={{fontSize: 11.5}}>
                  {draftPreview.kind === "draftable" && "AI-drafted starter · fill [BRACKETED PLACEHOLDERS], save as PDF, upload"}
                  {draftPreview.kind === "request" && "Email/message template · send to issuing party, then upload their reply"}
                  {draftPreview.kind === "gather" && "Where to find this · log in, export, save, upload"}
                </div>
              </div>
              <div style={{display:"flex", gap:6}}>
                <button className="btn btn-primary btn-sm" onClick={downloadDraftAsFile}>Download .md</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDraftPreview(null)}>Close</button>
              </div>
            </div>
            <pre className="draft-preview">{draftPreview.content}</pre>
          </div>
        </div>
      )}

      {groups.map(grp => {
        const items = docs.filter(d => d.required_for === grp.key);
        if (!items.length) return null;
        const grpUp = items.filter(d => d.status === "uploaded").length;
        return (
          <div key={grp.key} className="card" style={{marginBottom: 14}}>
            <div className="card-head">
              <h3>{grp.label}</h3>
              <span className="meta">{grpUp}/{items.length} ready</span>
            </div>
            <div>
              {items.sort((a,b) => (a.status === "missing" ? -1 : 1) - (b.status === "missing" ? -1 : 1)).map(d => {
                const expiringNow = d.expires && daysUntil(d.expires) < 90 && daysUntil(d.expires) > 0;
                return (
                  <div key={d.id} className="doc-row">
                    <div className={"ic " + d.status}>{d.status === "uploaded" ? I.check : I.doc}</div>
                    <div className="info">
                      <div className="name">{d.doc_name}</div>
                      <div className="desc">{d.description}</div>
                      {d.status === "uploaded" && (
                        <div className={"stamp " + (expiringNow ? "warn" : "")}>
                          uploaded {fmtDate(d.uploaded_at)}
                          {d.expires && <> · expires {fmtDate(d.expires)} {expiringNow && `· ${daysUntil(d.expires)}d left`}</>}
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex", gap:6, alignItems:"center"}}>
                      {d.status === "uploaded" ? (
                        <>
                          <button className="btn btn-ghost btn-sm">View</button>
                          <button className="btn btn-ghost btn-sm">Replace</button>
                        </>
                      ) : (() => {
                        const kind = templateKindFor(d);
                        if (kind === "draftable") {
                          return (
                            <>
                              <span className="kind-pill kind-draftable">Draftable</span>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => draftDocument(d)}
                                disabled={draftingId === d.id}
                              >
                                {draftingId === d.id ? "Drafting…" : "Draft with AI"}
                              </button>
                              <button className="btn btn-ghost btn-sm">Upload</button>
                            </>
                          );
                        }
                        if (kind === "request") {
                          return (
                            <>
                              <span className="kind-pill kind-request">Request</span>
                              <button className="btn btn-sm" onClick={() => draftDocument(d)} disabled={draftingId === d.id}>
                                {draftingId === d.id ? "…" : "Get email template"}
                              </button>
                              <button className="btn btn-ghost btn-sm">Upload</button>
                            </>
                          );
                        }
                        if (kind === "gather") {
                          return (
                            <>
                              <span className="kind-pill kind-gather">Gather</span>
                              <button className="btn btn-sm" onClick={() => draftDocument(d)} disabled={draftingId === d.id}>
                                {draftingId === d.id ? "…" : "Where to find"}
                              </button>
                              <button className="btn btn-ghost btn-sm">Upload</button>
                            </>
                          );
                        }
                        return <button className="btn btn-primary btn-sm">Upload</button>;
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.DraftsView = DraftsView;
window.SessionsView = SessionsView;
window.VaultView = VaultView;
