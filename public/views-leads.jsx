// Leads view — sales-page leads captured by /api/leads/submit.
// Reads through /api/leads/list (service-role, behind the portal Basic Auth gate);
// the browser anon key cannot read marketing_leads (RLS on, no policies).
const { useState: useStateLeads, useEffect: useEffectLeads } = React;

const LEAD_STATUSES = ["new", "contacted", "qualified", "onboarded", "closed"];

function LeadsView() {
  const { relTime } = window.Helpers || {};
  const [leads, setLeads]     = useStateLeads([]);
  const [loading, setLoading] = useStateLeads(true);
  const [error, setError]     = useStateLeads("");
  const [savingId, setSaving] = useStateLeads(null);

  useEffectLeads(() => {
    let alive = true;
    fetch("/api/leads/list")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
      .then(d => { if (alive) { setLeads(d.leads || []); setLoading(false); } })
      .catch(e => { if (alive) { setError(e.message || "Failed to load leads."); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try { return relTime ? relTime(iso) : new Date(iso).toLocaleDateString(); }
    catch { return iso; }
  };

  async function changeStatus(id, status) {
    const prev = leads;
    setSaving(id);
    setLeads(ls => ls.map(l => l.id === id ? { ...l, status } : l));   // optimistic
    try {
      const r = await fetch("/api/leads/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!r.ok) throw new Error("update failed");
    } catch {
      setLeads(prev);   // rollback
    } finally {
      setSaving(null);
    }
  }

  const counts = leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Leads</h1>
          <div className="sub">Sales-page captures from grantiq.operatorhq.agency · follow up and move them through the pipeline</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Marketing leads</h3>
          <span className="meta">
            {leads.length} total
            {counts.new ? ` · ${counts.new} new` : ""}
          </span>
        </div>

        {loading && <div className="muted" style={{padding:"18px 16px"}}>Loading leads…</div>}
        {error && !loading && <div className="muted" style={{padding:"18px 16px", color:"var(--red)"}}>{error}</div>}
        {!loading && !error && leads.length === 0 &&
          <div className="muted" style={{padding:"18px 16px"}}>No leads yet. Submissions from the sales page land here.</div>}

        {!loading && !error && leads.length > 0 && (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:110}}>Received</th>
                <th>Name</th>
                <th>Agency</th>
                <th>Contact</th>
                <th style={{width:110}}>Interest</th>
                <th style={{width:140}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l.id} style={{cursor:"default"}}>
                  <td className="mono muted" style={{fontSize:11.5}}>{fmtDate(l.created_at)}</td>
                  <td className="strong">
                    {l.full_name}
                    {l.message ? <div className="muted" style={{fontSize:11.5, fontWeight:400, marginTop:2}} title={l.message}>{l.message.length > 60 ? l.message.slice(0,60) + "…" : l.message}</div> : null}
                  </td>
                  <td>{l.agency_name || <span className="muted">—</span>}</td>
                  <td className="mono" style={{fontSize:11.5}}>
                    <a href={"mailto:" + l.email}>{l.email}</a>
                    {l.phone ? <div className="muted">{l.phone}</div> : null}
                  </td>
                  <td><span className="pill pill-ready">{l.interest || "trial"}</span></td>
                  <td>
                    <select
                      className="lead-status-select"
                      value={l.status}
                      disabled={savingId === l.id}
                      onChange={e => changeStatus(l.id, e.target.value)}
                    >
                      {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
