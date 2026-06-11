// Budgets view — budgetgen agent output, one per pursued grant.
// Implementation of the redesign handoff (claude.ai/design bundle, 2026-06-09).
// Reads from window.MOCK.BUDGETS for v1; live wiring to supabase budget_templates
// is a follow-up (table already exists in supabase-setup.sql).
const { useState: useStateBud } = React;

function BudgetsView({ orgFilter, onNav }) {
  const { BUDGETS } = window.MOCK;
  const { relTime, orgShort } = window.Helpers;
  const I = window.IconSet;

  const inOrg = (id) => orgFilter === "all" || id === orgFilter;
  const list = BUDGETS.filter(b => inOrg(b.org_id));
  const [open, setOpen] = useStateBud(list[0] ? list[0].id : null);

  const fmt = (n) => "$" + n.toLocaleString();
  const ready = list.filter(b => b.status === "ready").length;
  const totalValue = list.reduce((a, b) => a + b.total, 0);

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Budgets</h1>
          <div className="sub">
            {list.length} budget{list.length === 1 ? "" : "s"} generated · {ready} ready · {fmt(totalValue)} total requested
          </div>
        </div>
        <div className="actions">
          <button className="btn"><span>{I.refresh}</span> Regenerate</button>
          <button className="btn btn-primary"><span>{I.budget}</span> New budget</button>
        </div>
      </div>

      <div className="cal-kpis" style={{gridTemplateColumns: "repeat(3,1fr)"}}>
        <div className="kpi"><div className="lbl">Budgets ready</div><div className="val" style={{color: "var(--green)"}}>{ready}/{list.length}</div></div>
        <div className="kpi"><div className="lbl">Total requested</div><div className="val">{fmt(totalValue)}</div></div>
        <div className="kpi"><div className="lbl">Avg request</div><div className="val">{fmt(Math.round(totalValue / (list.length || 1)))}</div></div>
      </div>

      {list.map(b => {
        const isOpen = open === b.id;
        const max = Math.max(...b.lines.map(l => l.amount));
        return (
          <div key={b.id} className="card" style={{marginBottom: 12}}>
            <div className="card-head budget-head" onClick={() => setOpen(isOpen ? null : b.id)} style={{cursor: "pointer"}}>
              <div>
                <h3>{b.grant_name}</h3>
                <div className="muted" style={{fontSize: 12.5, marginTop: 3}}>
                  {orgShort(b.org_id)} · {b.lines.length} line items · updated {relTime(b.updated)}
                </div>
              </div>
              <div style={{display: "flex", alignItems: "center", gap: 14}}>
                <div style={{textAlign: "right"}}>
                  <div className="budget-total">{fmt(b.total)}</div>
                  <div className="muted" style={{fontSize: 11.5}}>match: {b.match_required}</div>
                </div>
                <span className={"pill pill-" + (b.status === "ready" ? "ready" : "drafting")}>{b.status}</span>
              </div>
            </div>
            {isOpen && (
              <div>
                {b.lines.map((l, i) => (
                  <div key={i} className="budget-line">
                    <div className="cat">{l.cat}</div>
                    <div className="track"><div className="fill" style={{width: (l.amount / max * 100) + "%"}} /></div>
                    <div className="amt">{fmt(l.amount)}</div>
                    <div className="note">{l.note}</div>
                  </div>
                ))}
                <div className="budget-line total">
                  <div className="cat">Total request</div>
                  <div className="track" />
                  <div className="amt">{fmt(b.total)}</div>
                  <div className="note" />
                </div>
                <div className="budget-actions">
                  <button className="btn btn-sm" onClick={() => onNav("grant", { grantId: b.grant_id })}>Open grant</button>
                  <button className="btn btn-sm">Export .xlsx</button>
                  <button className="btn btn-sm">Map to SF-424A</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {list.length === 0 && (
        <div className="empty">
          <div className="icon">$</div>
          <div className="title">No budgets yet</div>
          <div className="sub">Start a grant application and the budgetgen agent will draft one here.</div>
        </div>
      )}
    </div>
  );
}

window.BudgetsView = BudgetsView;
