// Project Brief view — shows the structured profile for the active org.
// Edit mode is in-place: every field becomes a textarea on click.
// Persists via PUT /api/orgs/brief.

const { useState: useStateBrief, useEffect: useEffectBrief, useMemo: useMemoBrief } = React;

const EMPTY_BRIEF = {
  metrics: [],
  who_we_are: "",
  the_problem: "",
  our_solution: "",
  target_population: [],
  why_us: [],
  funding_alignment: [],
  funding_request: "",
};

function BriefView({ orgFilter }) {
  const { ORGS } = window.MOCK;
  const activeOrgId = orgFilter === "all" ? null : orgFilter;
  const org = ORGS.find(o => o.id === activeOrgId);

  const [brief, setBrief] = useStateBrief(EMPTY_BRIEF);
  const [loading, setLoading] = useStateBrief(false);
  const [editing, setEditing] = useStateBrief(false);
  const [saving, setSaving] = useStateBrief(false);
  const [error, setError] = useStateBrief(null);

  useEffectBrief(() => {
    if (!activeOrgId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/orgs/brief?org_id=${encodeURIComponent(activeOrgId)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setBrief({ ...EMPTY_BRIEF, ...(d.brief || {}) });
        } else {
          setError(d.error || "fetch failed");
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeOrgId]);

  async function save() {
    if (!activeOrgId) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/orgs/brief", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: activeOrgId, brief }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || `HTTP ${r.status}`);
      } else {
        setEditing(false);
      }
    } catch (e) {
      setError("Network error: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (orgFilter === "all") {
    return (
      <div className="empty-state">
        <h3>Pick a business to view its brief</h3>
        <p>Project briefs are per-org. Use the sidebar to select Holigenix, K1, AI Junkies, or any other business you've added.</p>
      </div>
    );
  }
  if (!org) {
    return <div className="empty-state"><h3>Org not found</h3></div>;
  }
  if (loading) {
    return <div className="empty-state"><p>Loading {org.name}'s brief…</p></div>;
  }

  // ─── Metric editor row ──────────────────────────────────────────────────
  function setMetric(idx, key, val) {
    setBrief(b => {
      const m = [...(b.metrics || [])];
      m[idx] = { ...(m[idx] || {}), [key]: val };
      return { ...b, metrics: m };
    });
  }
  function addMetric() {
    setBrief(b => ({ ...b, metrics: [...(b.metrics || []), { label: "", value: "", note: "" }] }));
  }
  function removeMetric(idx) {
    setBrief(b => ({ ...b, metrics: (b.metrics || []).filter((_, i) => i !== idx) }));
  }

  // ─── Why-us subsection editor ───────────────────────────────────────────
  function setWhy(idx, key, val) {
    setBrief(b => {
      const w = [...(b.why_us || [])];
      w[idx] = { ...(w[idx] || {}), [key]: val };
      return { ...b, why_us: w };
    });
  }
  function addWhy() {
    setBrief(b => ({ ...b, why_us: [...(b.why_us || []), { heading: "", body: "" }] }));
  }
  function removeWhy(idx) {
    setBrief(b => ({ ...b, why_us: (b.why_us || []).filter((_, i) => i !== idx) }));
  }

  // ─── List editors (target_population, funding_alignment) ────────────────
  function listSet(key, idx, val) {
    setBrief(b => { const a = [...(b[key] || [])]; a[idx] = val; return { ...b, [key]: a }; });
  }
  function listAdd(key) {
    setBrief(b => ({ ...b, [key]: [...(b[key] || []), ""] }));
  }
  function listRemove(key, idx) {
    setBrief(b => ({ ...b, [key]: (b[key] || []).filter((_, i) => i !== idx) }));
  }

  return (
    <div className="brief-view">
      <div className="brief-head">
        <div>
          <h2>{org.name}</h2>
          {brief.tagline && <div className="brief-tagline">{brief.tagline}</div>}
          {brief.subtitle && <div className="brief-subtitle">{brief.subtitle}</div>}
          {!brief.tagline && !brief.subtitle && <p className="sub">Project brief — used by the Grants agent when reasoning about grant fit.</p>}
          {(brief.founded_year || brief.vision_line) && (
            <div className="brief-meta-row">
              {brief.founded_year && <span className="brief-chip">Founded {brief.founded_year}</span>}
              {brief.vision_line && <span className="brief-vision">{brief.vision_line}</span>}
            </div>
          )}
        </div>
        <div className="brief-actions">
          {!editing ? (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>Edit brief</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save brief"}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {/* ─── Metrics ──────────────────────────────────────────────────── */}
      <section className="brief-section">
        <h3>Key metrics</h3>
        {!editing && (brief.metrics || []).length === 0 && (
          <p className="muted">No metrics yet. Add 3-4 numbers that prove this org works (e.g., learners trained, dollars deployed, clients served).</p>
        )}
        {(brief.metrics || []).length > 0 && (
          <div className="metric-grid">
            {(brief.metrics || []).map((m, i) => editing ? (
              <div key={i} className="metric-card editing">
                <input value={m.value || ""} onChange={e => setMetric(i, "value", e.target.value)} placeholder="178" className="metric-value-input" />
                <input value={m.label || ""} onChange={e => setMetric(i, "label", e.target.value)} placeholder="Learners Trained" className="metric-label-input" />
                <input value={m.note || ""} onChange={e => setMetric(i, "note", e.target.value)} placeholder="AI & tech skills curriculum" className="metric-note-input" />
                <button className="btn btn-ghost btn-sm" onClick={() => removeMetric(i)}>×</button>
              </div>
            ) : (
              <div key={i} className="metric-card">
                <div className="metric-value">{m.value}</div>
                <div className="metric-label">{m.label}</div>
                {m.note && <div className="metric-note">{m.note}</div>}
              </div>
            ))}
          </div>
        )}
        {editing && <button className="btn btn-ghost btn-sm" onClick={addMetric}>+ Add metric</button>}
      </section>

      {/* ─── Narrative blocks ─────────────────────────────────────────── */}
      <NarrativeBlock label="Who we are" value={brief.who_we_are || ""}
        editing={editing} onChange={v => setBrief(b => ({ ...b, who_we_are: v }))} />

      {/* Problem — show breakdown if present, fall through to plain narrative otherwise */}
      {(brief.the_problem_breakdown || []).length > 0 && !editing ? (
        <section className="brief-section">
          <h3>The problem</h3>
          <div className="problem-grid">
            {brief.the_problem_breakdown.map((p, i) => (
              <div key={i} className="problem-card">
                <div className="problem-title">{p.title}</div>
                <div className="problem-body">{p.body}</div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <NarrativeBlock label="The problem" value={brief.the_problem || ""}
          editing={editing} onChange={v => setBrief(b => ({ ...b, the_problem: v }))} />
      )}

      <NarrativeBlock label="Our solution" value={brief.our_solution || ""}
        editing={editing} onChange={v => setBrief(b => ({ ...b, our_solution: v }))} />

      {/* Pillars — only render in view mode if present */}
      {(brief.pillars || []).length > 0 && !editing && (
        <section className="brief-section">
          <h3>Three pillars. One pipeline.</h3>
          <div className="pillars-grid">
            {brief.pillars.map((p, i) => (
              <div key={i} className={"pillar-card pillar-" + (p.color || "blue")}>
                <div className="pillar-head">{p.icon || p.label}</div>
                <ul className="pillar-list">
                  {(p.items || []).map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Target population — detailed cards if present, otherwise flat list ─── */}
      {(brief.target_population_detail || []).length > 0 && !editing ? (
        <section className="brief-section">
          <h3>Who we serve</h3>
          <div className="population-grid">
            {brief.target_population_detail.map((p, i) => (
              <div key={i} className={"population-card pop-" + (p.color || "blue")}>
                <div className="pop-group">{p.group}</div>
                {p.sub && <div className="pop-sub">{p.sub}</div>}
                <div className="pop-body">{p.body}</div>
                <ul className="pop-items">
                  {(p.items || []).map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <ListBlock label="Target population" items={brief.target_population || []}
          editing={editing}
          onSet={(i, v) => listSet("target_population", i, v)}
          onAdd={() => listAdd("target_population")}
          onRemove={(i) => listRemove("target_population", i)}
          placeholder="Youth & Young Adults (16-24)" />
      )}

      {/* ─── Students Have Built (tag cloud) ─────────────────────────── */}
      {(brief.students_have_built || []).length > 0 && !editing && (
        <section className="brief-section">
          <h3>Students have built</h3>
          <div className="tag-cloud">
            {brief.students_have_built.map((t, i) => (
              <span key={i} className="tag-chip">{t}</span>
            ))}
          </div>
        </section>
      )}

      {/* ─── Why us ──────────────────────────────────────────────────── */}
      <section className="brief-section">
        <h3>Why this organization</h3>
        {(brief.why_us || []).map((w, i) => editing ? (
          <div key={i} className="why-block editing">
            <input value={w.heading || ""} onChange={e => setWhy(i, "heading", e.target.value)} placeholder="Already Operational" className="why-head-input" />
            <textarea value={w.body || ""} onChange={e => setWhy(i, "body", e.target.value)} placeholder="One-paragraph proof point" rows={3} />
            <button className="btn btn-ghost btn-sm" onClick={() => removeWhy(i)}>Remove</button>
          </div>
        ) : (
          <div key={i} className="why-block">
            <h4>{w.heading}</h4>
            <p>{w.body}</p>
          </div>
        ))}
        {editing && <button className="btn btn-ghost btn-sm" onClick={addWhy}>+ Add reason</button>}
      </section>

      {/* ─── Funding alignment — detailed if present, otherwise simple list ── */}
      {(brief.funding_alignment_detail || []).length > 0 && !editing ? (
        <section className="brief-section">
          <h3>Funding alignment</h3>
          <div className="alignment-grid">
            {brief.funding_alignment_detail.map((cat, i) => (
              <div key={i} className="alignment-card">
                <div className="alignment-cat">{cat.category}</div>
                <ul>
                  {(cat.points || []).map((p, j) => <li key={j}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <ListBlock label="Funding alignment (grant categories this org fits)"
          items={brief.funding_alignment || []}
          editing={editing}
          onSet={(i, v) => listSet("funding_alignment", i, v)}
          onAdd={() => listAdd("funding_alignment")}
          onRemove={(i) => listRemove("funding_alignment", i)}
          placeholder="DOL Workforce Innovation (WIOA)" />
      )}

      {/* ─── Use of funds ─────────────────────────────────────────────── */}
      {(brief.use_of_funds || []).length > 0 && !editing && (
        <section className="brief-section">
          <h3>Use of funds</h3>
          <div className="uof-list">
            {brief.use_of_funds.map((u, i) => (
              <div key={i} className="uof-row">
                <div className="uof-pct">{u.pct}%</div>
                <div className="uof-body">
                  <div className="uof-label">{u.label}</div>
                  <div className="uof-desc">{u.body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Roadmap ──────────────────────────────────────────────────── */}
      {(brief.roadmap || []).length > 0 && !editing && (
        <section className="brief-section">
          <h3>Roadmap</h3>
          <div className="roadmap-grid">
            {brief.roadmap.map((r, i) => (
              <div key={i} className={"roadmap-card status-" + (r.status || "future")}>
                <div className="roadmap-phase">{r.phase}</div>
                <div className="roadmap-label">{r.label}</div>
                <ul>
                  {(r.items || []).map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Grant funding request ────────────────────────────────────── */}
      <NarrativeBlock label="Grant funding request" value={brief.funding_request || ""}
        editing={editing} onChange={v => setBrief(b => ({ ...b, funding_request: v }))} />

      {/* ─── Closing pitch ────────────────────────────────────────────── */}
      {brief.closing_pitch && !editing && (
        <section className="brief-section closing-section">
          <div className="closing-pitch">{brief.closing_pitch}</div>
        </section>
      )}
    </div>
  );
}

function NarrativeBlock({ label, value, editing, onChange }) {
  return (
    <section className="brief-section">
      <h3>{label}</h3>
      {editing ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={4}
          placeholder={`Describe — ${label.toLowerCase()}.`} />
      ) : (
        value ? <p className="brief-prose">{value}</p>
              : <p className="muted">Not set. Click "Edit brief" to add.</p>
      )}
    </section>
  );
}

function ListBlock({ label, items, editing, onSet, onAdd, onRemove, placeholder }) {
  return (
    <section className="brief-section">
      <h3>{label}</h3>
      {items.length === 0 && !editing && <p className="muted">Empty.</p>}
      <ul className="brief-list">
        {items.map((item, i) => editing ? (
          <li key={i} className="editing">
            <input value={item} onChange={e => onSet(i, e.target.value)} placeholder={placeholder} />
            <button className="btn btn-ghost btn-sm" onClick={() => onRemove(i)}>×</button>
          </li>
        ) : (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {editing && <button className="btn btn-ghost btn-sm" onClick={onAdd}>+ Add item</button>}
    </section>
  );
}

window.BriefView = BriefView;
