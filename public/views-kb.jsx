// Knowledge Base view — per-org reference material the Grants agent reads
// from when reasoning about grants. Three kinds of entries:
//   - note:         markdown/text body
//   - link:         URL with optional notes
//   - file_summary: PDF/image upload (stored in Supabase Storage org-kb bucket)
//                   plus an optional summary the agent uses

const { useState: useStateKB, useEffect: useEffectKB } = React;

function KBView({ orgFilter }) {
  const { ORGS } = window.MOCK;
  const activeOrgId = orgFilter === "all" ? null : orgFilter;
  const org = ORGS.find(o => o.id === activeOrgId);

  const [entries, setEntries] = useStateKB([]);
  const [files, setFiles] = useStateKB([]);
  const [loading, setLoading] = useStateKB(false);
  const [adding, setAdding] = useStateKB(null); // null | "note" | "link"
  const [uploading, setUploading] = useStateKB(false);
  const [error, setError] = useStateKB(null);

  function refresh() {
    if (!activeOrgId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/orgs/kb?org_id=${encodeURIComponent(activeOrgId)}`).then(r => r.json()),
      fetch(`/api/orgs/kb-files?org_id=${encodeURIComponent(activeOrgId)}`).then(r => r.json()),
    ])
      .then(([e, f]) => {
        setEntries(e.entries || []);
        setFiles(f.files || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffectKB(() => { refresh(); }, [activeOrgId]);

  async function uploadFile(file) {
    if (!activeOrgId || !file) return;
    setUploading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        org_id: activeOrgId,
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
      });
      const r = await fetch(`/api/orgs/kb-upload?${params}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || `upload failed: HTTP ${r.status}`);
      } else {
        refresh();
      }
    } catch (e) {
      setError("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteEntry(id) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/orgs/kb?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    refresh();
  }

  async function deleteFile(file_id) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    await fetch(`/api/orgs/kb-files?file_id=${encodeURIComponent(file_id)}`, { method: "DELETE" });
    refresh();
  }

  if (orgFilter === "all") {
    return (
      <div className="empty-state">
        <h3>Pick a business to view its knowledge base</h3>
        <p>Knowledge bases are per-org. The Grants agent reads from the active org's KB when reasoning about grant fit.</p>
      </div>
    );
  }
  if (!org) return <div className="empty-state"><h3>Org not found</h3></div>;

  const formatBytes = (n) => {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="kb-view">
      <div className="brief-head">
        <div>
          <h2>{org.name} — Knowledge base</h2>
          <p className="sub">Notes, links, and uploaded reference docs the Grants agent uses when reasoning about this org's grant fit.</p>
        </div>
        <div className="brief-actions">
          <button className="btn btn-ghost" onClick={() => setAdding("note")}>+ Note</button>
          <button className="btn btn-ghost" onClick={() => setAdding("link")}>+ Link</button>
          <label className="btn btn-primary" style={{cursor:"pointer"}}>
            {uploading ? "Uploading…" : "+ Upload"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,text/markdown,text/plain"
              style={{display:"none"}}
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { uploadFile(f); e.target.value = ""; }
              }}
            />
          </label>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {adding && (
        <KBAddForm
          kind={adding}
          orgId={activeOrgId}
          onClose={() => setAdding(null)}
          onCreated={() => { setAdding(null); refresh(); }}
        />
      )}

      {/* ─── Files ──────────────────────────────────────────────────── */}
      <section className="brief-section">
        <h3>Files {files.length > 0 && <span className="count">{files.length}</span>}</h3>
        {loading && files.length === 0 && <p className="muted">Loading…</p>}
        {!loading && files.length === 0 && <p className="muted">No files yet. Upload PDFs or images via the Upload button.</p>}
        {files.length > 0 && (
          <div className="kb-file-list">
            {files.map(f => (
              <div key={f.id} className="kb-file-row">
                <div className="kb-file-icon">{f.mime_type?.startsWith("image/") ? "IMG" : "PDF"}</div>
                <div className="kb-file-meta">
                  <a href={f.signed_url} target="_blank" rel="noopener noreferrer" className="kb-file-name">{f.filename}</a>
                  <div className="kb-file-sub">
                    <span>{formatBytes(f.size_bytes)}</span>
                    <span>·</span>
                    <span>{new Date(f.uploaded_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteFile(f.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Notes & links ──────────────────────────────────────────── */}
      <section className="brief-section">
        <h3>Notes & links {entries.length > 0 && <span className="count">{entries.length}</span>}</h3>
        {!loading && entries.length === 0 && <p className="muted">No notes or links yet. Add operational context the agent should know about (mission nuances, partnerships, certifications in progress, links to your website / brand assets / impact reports).</p>}
        {entries.length > 0 && (
          <div className="kb-entry-list">
            {entries.map(e => (
              <div key={e.id} className={"kb-entry kb-entry-" + e.kind}>
                <div className="kb-entry-head">
                  <span className="kb-entry-kind">{e.kind}</span>
                  <span className="kb-entry-title">{e.title}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteEntry(e.id)}>×</button>
                </div>
                {e.url && <div className="kb-entry-url"><a href={e.url} target="_blank" rel="noopener noreferrer">{e.url}</a></div>}
                {e.body && <div className="kb-entry-body">{e.body}</div>}
                <div className="kb-entry-meta">{new Date(e.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function KBAddForm({ kind, orgId, onClose, onCreated }) {
  const [title, setTitle] = useStateKB("");
  const [body, setBody]   = useStateKB("");
  const [url, setUrl]     = useStateKB("");
  const [submitting, setSubmitting] = useStateKB(false);
  const [error, setError] = useStateKB(null);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/orgs/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: orgId, kind,
          title: title.trim(),
          body:  body.trim() || null,
          url:   url.trim()  || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || `HTTP ${r.status}`);
      else onCreated();
    } catch (e2) {
      setError("Network error: " + e2.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="kb-add-form">
      <form onSubmit={submit} className="modal-body" style={{padding:"14px 0"}}>
        <div className="form-row">
          <label style={{flex:1}}>
            <span className="form-label">{kind === "note" ? "Note title" : "Link title"}</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder={kind === "note" ? "Mission notes from board meeting" : "AI Junkies website"} />
          </label>
        </div>
        {kind === "link" && (
          <label className="form-row-1">
            <span className="form-label">URL</span>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          </label>
        )}
        <label className="form-row-1">
          <span className="form-label">{kind === "link" ? "Notes (optional)" : "Body (markdown)"}</span>
          <textarea rows={5} value={body} onChange={e => setBody(e.target.value)}
            placeholder={kind === "link" ? "What's at this link, why does it matter to grants" : "Anything the agent should know"} />
        </label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-foot" style={{padding:"10px 0 0"}}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim()}>
            {submitting ? "Saving…" : `Add ${kind}`}
          </button>
        </div>
      </form>
    </div>
  );
}

window.KBView = KBView;
