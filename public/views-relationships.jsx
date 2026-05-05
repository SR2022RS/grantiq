// Funders + Submissions + Templates views
const { useState: useStateR } = React;

function FundersView({ orgFilter, onNav }) {
  const { FUNDERS, SUBMISSIONS, GRANTS } = window.MOCK;
  const { fmtDate, fmtShortDate } = window.Helpers;
  const I = window.IconSet;

  // Filter funders by whether the active org has any submission/grant with them
  const relevantFunderIds = orgFilter === "all" ? null : new Set([
    ...SUBMISSIONS.filter(s => s.org_id === orgFilter).map(s => s.funder_id),
    // also derive from upcoming grants by funder name match
    ...GRANTS.filter(g => g.org_id === orgFilter).map(g => FUNDERS.find(f => f.name === g.funder)?.id).filter(Boolean),
  ]);
  const list = relevantFunderIds ? FUNDERS.filter(f => relevantFunderIds.has(f.id)) : FUNDERS;

  const winRate = (f) => {
    const subs = SUBMISSIONS.filter(s => s.funder_id === f.id);
    if (!subs.length) return null;
    return Math.round((subs.filter(s => s.status === "awarded").length / subs.length) * 100);
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Funders</h1>
          <div className="sub">{list.length} relationship{list.length===1?"":"s"} tracked · {list.filter(f=>f.relationship==="active").length} active</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-sm">+ Add funder</button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Funder</th>
              <th style={{width:130}}>Type</th>
              <th style={{width:120}}>Relationship</th>
              <th>Contact</th>
              <th style={{width:100}}>Win rate</th>
              <th style={{width:140}}>Total awarded</th>
              <th style={{width:120}}>Next cycle</th>
              <th style={{width:80}} />
            </tr>
          </thead>
          <tbody>
            {list.sort((a,b) => parseInt(b.total_awarded.replace(/\D/g,""))||0 - (parseInt(a.total_awarded.replace(/\D/g,""))||0)).map(f => {
              const wr = winRate(f);
              return (
                <tr key={f.id} style={{cursor:"default"}}>
                  <td className="strong">{f.name}</td>
                  <td className="muted" style={{fontSize:11.5}}>{f.type}</td>
                  <td><span className={"pill pill-" + (f.relationship === "active" ? "ready" : f.relationship === "warm" ? "warn" : "low")}>{f.relationship}</span></td>
                  <td className="muted" style={{fontSize:11.5}}>
                    {f.contact !== "—" ? f.contact : <span style={{color:"var(--text-4)"}}>no contact</span>}
                    {f.email !== "—" && <div className="mono" style={{fontSize:10.5, marginTop:1}}>{f.email}</div>}
                  </td>
                  <td>{wr !== null ? <span className="num" style={{color: wr >= 50 ? "var(--green)" : wr > 0 ? "var(--yellow)" : "var(--red)"}}>{wr}%</span> : <span className="muted">—</span>}</td>
                  <td className="num">{f.total_awarded}</td>
                  <td className="muted mono" style={{fontSize:11}}>{f.next_cycle ? fmtShortDate(f.next_cycle) : "—"}</td>
                  <td className="right-actions"><button className="btn btn-ghost btn-sm">Open</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubmissionsView({ orgFilter }) {
  const { SUBMISSIONS, FUNDERS } = window.MOCK;
  const { fmtDate, fmtShortDate, orgShort } = window.Helpers;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const list = SUBMISSIONS.filter(s => inOrg(s.org_id)).sort((a,b) => new Date(b.submitted) - new Date(a.submitted));

  const awarded = list.filter(s => s.status === "awarded");
  const declined = list.filter(s => s.status === "declined");
  const totalAwarded = awarded.reduce((sum, s) => sum + (parseInt(s.amount_awarded.replace(/\D/g,""))||0), 0);
  const totalRequested = list.reduce((sum, s) => sum + (parseInt(s.amount_requested.replace(/\D/g,""))||0), 0);
  const winRate = list.length ? Math.round((awarded.length / list.length) * 100) : 0;
  const totalCost = list.reduce((sum, s) => sum + (parseInt(s.agent_cost?.replace(/\D/g,""))||0), 0);
  const totalHours = list.reduce((sum, s) => sum + (s.agent_hours || 0), 0);

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Submissions</h1>
          <div className="sub">{list.length} historic submission{list.length===1?"":"s"} · win rate {winRate}%</div>
        </div>
      </div>

      <div className="cal-kpis">
        <div className="kpi"><div className="lbl">Awarded</div><div className="val" style={{color:"var(--green)"}}>{awarded.length}</div></div>
        <div className="kpi"><div className="lbl">Total awarded</div><div className="val">${(totalAwarded/1000).toFixed(0)}k</div></div>
        <div className="kpi"><div className="lbl">Win rate</div><div className="val accent">{winRate}%</div></div>
        <div className="kpi"><div className="lbl">Agent cost (lifetime)</div><div className="val">${totalCost}</div><div className="sub2">{totalHours.toFixed(1)}h · ROI ${Math.round(totalAwarded/Math.max(totalCost,1)).toLocaleString()}:1</div></div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Grant</th>
              <th style={{width:110}}>Org</th>
              <th style={{width:120}}>Status</th>
              <th style={{width:120}}>Requested</th>
              <th style={{width:120}}>Awarded</th>
              <th style={{width:110}}>Submitted</th>
              <th style={{width:110}}>Decided</th>
              <th style={{width:130}}>Confirmation</th>
              <th style={{width:110}}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {list.map(s => (
              <React.Fragment key={s.id}>
                <tr style={{cursor:"default"}}>
                  <td className="strong">{s.grant_name}</td>
                  <td className="muted" style={{fontSize:11.5}}>{orgShort(s.org_id)}</td>
                  <td><span className={"pill pill-" + (s.status === "awarded" ? "ready" : s.status === "declined" ? "low" : "warn")}>{s.status}</span></td>
                  <td className="num">{s.amount_requested}</td>
                  <td className="num" style={s.status === "awarded" ? {color:"var(--green)"} : {color:"var(--text-4)"}}>{s.amount_awarded}</td>
                  <td className="muted mono" style={{fontSize:11}}>{fmtShortDate(s.submitted)}</td>
                  <td className="muted mono" style={{fontSize:11}}>{fmtShortDate(s.decided)}</td>
                  <td className="mono" style={{fontSize:10.5}}>{s.confirmation}</td>
                  <td className="muted mono" style={{fontSize:11}}>{s.agent_cost} · {s.agent_hours}h</td>
                </tr>
                {s.reviewer_notes && (
                  <tr style={{cursor:"default", background:"var(--surface)"}}>
                    <td colSpan="9" style={{padding:"6px 12px 12px 28px", fontSize:11.5, color:"var(--text-3)", borderBottom:"1px solid var(--hairline)"}}>
                      <strong style={{color:"var(--yellow)"}}>Reviewer:</strong> {s.reviewer_notes}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TemplatesView({ orgFilter }) {
  const { TEMPLATES } = window.MOCK;
  const { fmtShortDate, orgShort } = window.Helpers;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const list = TEMPLATES.filter(t => inOrg(t.org_id));
  const [expand, setExpand] = useStateR(null);

  const cats = Array.from(new Set(list.map(t => t.category)));

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Templates</h1>
          <div className="sub">{list.length} reusable narrative block{list.length===1?"":"s"} · agents pull these into drafts</div>
        </div>
        <div className="actions">
          <button className="btn btn-primary btn-sm">+ New template</button>
        </div>
      </div>

      {cats.map(cat => (
        <div key={cat} className="card" style={{marginBottom:14}}>
          <div className="card-head">
            <h3 style={{textTransform:"capitalize"}}>{cat.replace("-"," ")}</h3>
            <span className="meta">{list.filter(t => t.category === cat).length} templates</span>
          </div>
          {list.filter(t => t.category === cat).map(t => (
            <div key={t.id} className="tpl-row">
              <div className="info" onClick={() => setExpand(expand === t.id ? null : t.id)}>
                <div className="name">{t.name}</div>
                <div className="meta">{orgShort(t.org_id)} · {t.word_count} words · {t.uses} uses · last {fmtShortDate(t.last_used)}</div>
              </div>
              <div className="actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setExpand(expand === t.id ? null : t.id)}>{expand === t.id ? "Hide" : "Preview"}</button>
                <button className="btn btn-ghost btn-sm">Edit</button>
                <button className="btn btn-sm">Insert</button>
              </div>
              {expand === t.id && (
                <div className="tpl-preview">{t.body}</div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

window.FundersView = FundersView;
window.SubmissionsView = SubmissionsView;
window.TemplatesView = TemplatesView;
