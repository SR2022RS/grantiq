// AddOrgModal — onboard a new business into GrantIQ.
// Posts to /api/orgs/create which scaffolds 4 generic templates
// (capability_statement, org_chart, board_list, w9) so Draft-with-AI
// works the moment the org is created.

const { useState: useStateAOM } = React;

function slugifyId(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function AddOrgModal({ onClose, onCreated }) {
  const [name, setName] = useStateAOM("");
  const [shortName, setShortName] = useStateAOM("");
  const [orgType, setOrgType] = useStateAOM("");
  const [state, setState] = useStateAOM("");
  const [mission, setMission] = useStateAOM("");
  const [ein, setEin] = useStateAOM("");
  const [uei, setUei] = useStateAOM("");
  const [address, setAddress] = useStateAOM("");
  const [email, setEmail] = useStateAOM("");
  const [operationsLead, setOperationsLead] = useStateAOM("");
  const [certs, setCerts] = useStateAOM("");
  const [submitting, setSubmitting] = useStateAOM(false);
  const [error, setError] = useStateAOM(null);

  const id = slugifyId(name);
  const canSubmit = name.trim().length >= 2 && !submitting;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/orgs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: name.trim(),
          short: shortName.trim() || name.trim(),
          orgType: orgType.trim(),
          state: state.trim(),
          mission: mission.trim(),
          ein: ein.trim(),
          uei: uei.trim(),
          address: address.trim(),
          email: email.trim(),
          operations_lead: operationsLead.trim(),
          certs: certs.split(",").map(c => c.trim()).filter(Boolean),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || `HTTP ${r.status}`);
      } else {
        onCreated(j.org);
      }
    } catch (e2) {
      setError("Network error: " + e2.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card add-org-modal">
        <div className="modal-head">
          <div>
            <h2>Add a business</h2>
            <p className="sub">Onboard a new org into GrantIQ. We'll scaffold 4 starter templates so Draft-with-AI works on day one.</p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} title="Close">×</button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="form-row">
            <label>
              <span className="form-label">Business name <span className="req">*</span></span>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="AI Junkies University" autoFocus />
              {id && <div className="form-hint">id: <code>{id}</code></div>}
            </label>
            <label>
              <span className="form-label">Short name</span>
              <input type="text" value={shortName} onChange={e => setShortName(e.target.value)} placeholder="AI Junkies" />
            </label>
          </div>

          <div className="form-row">
            <label>
              <span className="form-label">Org type</span>
              <input type="text" value={orgType} onChange={e => setOrgType(e.target.value)} placeholder="Workforce dev / Online university" />
            </label>
            <label>
              <span className="form-label">State / region</span>
              <input type="text" value={state} onChange={e => setState(e.target.value)} placeholder="Georgia (Online)" />
            </label>
          </div>

          <label className="form-row-1">
            <span className="form-label">Mission statement</span>
            <textarea rows={3} value={mission} onChange={e => setMission(e.target.value)} placeholder="One-sentence mission. The agent uses this verbatim in proposals." />
          </label>

          <div className="form-row">
            <label>
              <span className="form-label">EIN</span>
              <input type="text" value={ein} onChange={e => setEin(e.target.value)} placeholder="XX-XXXXXXX" />
            </label>
            <label>
              <span className="form-label">UEI (SAM.gov)</span>
              <input type="text" value={uei} onChange={e => setUei(e.target.value)} placeholder="if registered" />
            </label>
          </div>

          <label className="form-row-1">
            <span className="form-label">Address</span>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, State ZIP" />
          </label>

          <div className="form-row">
            <label>
              <span className="form-label">Contact email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@business.com" />
            </label>
            <label>
              <span className="form-label">Operations lead</span>
              <input type="text" value={operationsLead} onChange={e => setOperationsLead(e.target.value)} placeholder="Jane Doe — CEO" />
            </label>
          </div>

          <label className="form-row-1">
            <span className="form-label">Certifications (comma-separated)</span>
            <input type="text" value={certs} onChange={e => setCerts(e.target.value)} placeholder="DOL WIOA, Education/STEM, Equity" />
          </label>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {submitting ? "Creating…" : "Create business"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

window.AddOrgModal = AddOrgModal;
