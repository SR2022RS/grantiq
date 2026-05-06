// AddGrantModal — manually inject a grant the user found in the wild
// (LinkedIn post, conference, foundation directory, email tip, etc.).
// Submission kicks off async research via /api/grants/add.

const { useState: useStateAGM } = React;

function AddGrantModal({ defaultOrgId, onClose, onCreated }) {
  const { ORGS } = window.MOCK;
  const orgs = ORGS.filter(o => o.id !== "all");
  const [orgId, setOrgId] = useStateAGM(defaultOrgId !== "all" ? defaultOrgId : (orgs[0]?.id || ""));
  const [name, setName]   = useStateAGM("");
  const [funder, setFunder] = useStateAGM("");
  const [amount, setAmount] = useStateAGM("");
  const [deadline, setDeadline] = useStateAGM("");
  const [url, setUrl] = useStateAGM("");
  const [notes, setNotes] = useStateAGM("");
  const [submitting, setSubmitting] = useStateAGM(false);
  const [error, setError] = useStateAGM(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !orgId) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/grants/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId,
          name: name.trim(),
          funder: funder.trim() || null,
          amount: amount.trim() || null,
          deadline: deadline.trim() || null,
          url: url.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || `HTTP ${r.status}`);
      } else {
        onCreated(j);
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
            <h2>Add a grant</h2>
            <p className="sub">
              Drop in a grant you found. If you provide a URL, the agent will research it
              in the background — eligibility, required documents, match score — and update this row.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} title="Close">×</button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="form-row">
            <label>
              <span className="form-label">Business <span className="req">*</span></span>
              <select value={orgId} onChange={e => setOrgId(e.target.value)} className="select">
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name || o.short}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="form-label">Grant name <span className="req">*</span></span>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="DOL Workforce Innovation 2026" autoFocus />
            </label>
          </div>

          <div className="form-row">
            <label>
              <span className="form-label">Funder</span>
              <input type="text" value={funder} onChange={e => setFunder(e.target.value)}
                placeholder="U.S. Department of Labor" />
            </label>
            <label>
              <span className="form-label">Amount</span>
              <input type="text" value={amount} onChange={e => setAmount(e.target.value)} placeholder="$250,000" />
            </label>
          </div>

          <div className="form-row">
            <label>
              <span className="form-label">Deadline</span>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
            </label>
            <label>
              <span className="form-label">Grant URL</span>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://grants.gov/..." />
            </label>
          </div>

          <label className="form-row-1">
            <span className="form-label">Notes (optional)</span>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="What you know already — referral source, deadline pressure, key requirements." />
          </label>

          {url && (
            <div className="research-hint">
              <strong>Async research will run.</strong> After submit, the agent fetches this URL
              and writes back eligibility analysis, required docs, and a match score in 20-60 seconds.
              Refresh the Pipeline page to see updates.
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
              {submitting ? "Adding…" : (url ? "Add + Research" : "Add grant")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

window.AddGrantModal = AddGrantModal;
