// App shell — sidebar, top bar, right rail, page router, tweaks
const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "showRightRail": true,
  "density": "comfortable",
  "accentHue": 38,
  "theme": "dark"
}/*EDITMODE-END*/;

function App() {
  const I = window.IconSet;
  const { ALERTS, AGENT_ACTIVITY, GRANTS, DRAFTS, SESSIONS, VAULT } = window.MOCK;
  const { relTime } = window.Helpers;

  const [page, setPage]           = useStateApp("inbox");
  const [orgFilter, setOrgFilter] = useStateApp("all");
  const [navCtx, setNavCtx]       = useStateApp({});
  const [tweaks, setTweak]        = window.useTweaks(TWEAK_DEFAULTS);

  // Apply density + accent hue tweaks to root
  useEffectApp(() => {
    document.documentElement.style.setProperty("--accent",   `oklch(0.78 0.16 ${tweaks.accentHue})`);
    document.documentElement.style.setProperty("--accent-2", `oklch(0.84 0.14 ${tweaks.accentHue})`);
    const hueAlpha = (a) => `oklch(0.78 0.16 ${tweaks.accentHue} / ${a})`;
    document.documentElement.style.setProperty("--accent-bg",   hueAlpha(0.10));
    document.documentElement.style.setProperty("--accent-bg-2", hueAlpha(0.20));
    document.body.style.fontSize = tweaks.density === "compact" ? "12.5px" : tweaks.density === "spacious" ? "13.5px" : "13px";
  }, [tweaks.accentHue, tweaks.density]);

  // Theme (dark/light) — write to <html data-theme>
  useEffectApp(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme || "dark");
  }, [tweaks.theme]);

  const onNav = (p, ctx = {}) => { setPage(p); setNavCtx(ctx); };

  const counts = {
    inbox:    SESSIONS.filter(s => s.status === "gated").length + DRAFTS.filter(d => d.status === "ready_for_review").length,
    pipeline: GRANTS.filter(g => ["new","reviewing","drafting"].includes(g.status)).length,
    drafts:   DRAFTS.filter(d => d.status === "ready_for_review").length,
    sessions: SESSIONS.filter(s => s.status === "gated").length,
    vault:    VAULT.filter(v => v.status === "missing").length,
  };

  const pageTitle = ({inbox:"Inbox", pipeline:"Pipeline", grant:"Grant detail", drafts:"Drafts", sessions:"Sessions", calendar:"Calendar", vault:"Vault", templates:"Templates", sources:"Sources", watchlists:"Watchlists", dismissed:"Dismissed", funders:"Funders", submissions:"Submissions", chat:"Chat", notes:"Notes", settings:"Settings"})[page];

  const showRail = tweaks.showRightRail && ["inbox","pipeline","drafts","vault","notes","settings","calendar","sources","funders"].includes(page);
  const liveAgents = AGENT_ACTIVITY.filter(a => Date.now() - new Date(a.t).getTime() < 30 * 60 * 1000).length;

  // Per-business counts for sidebar picker
  const orgCounts = (id) => {
    const inOrg = (oid) => id === "all" || oid === id;
    return {
      grants: GRANTS.filter(g => inOrg(g.org_id) && ["new","reviewing","drafting"].includes(g.status)).length,
      attention: SESSIONS.filter(s => inOrg(s.org_id) && s.status === "gated").length
        + DRAFTS.filter(d => inOrg(d.org_id) && d.status === "ready_for_review").length,
    };
  };

  const orgs = [
    { id: "all",                  label: "All businesses", short: "All",       letter: "·",  bodyClass: "org-all" },
    { id: "holigenix_healthcare", label: "Holigenix Healthcare", short: "Holigenix", letter: "H", bodyClass: "org-holigenix" },
    { id: "k1_management",        label: "K1 Management", short: "K1 Mgmt",   letter: "K", bodyClass: "org-k1" },
    { id: "owner_nonprofit",      label: "Owner Nonprofit", short: "Owner NP",letter: "O", bodyClass: "org-owner" },
  ];

  // Sync body class so org accent flows through CSS
  useEffectApp(() => {
    const cls = orgs.find(o => o.id === orgFilter)?.bodyClass || "org-all";
    document.body.className = cls;
  }, [orgFilter]);

  const activeOrg = orgs.find(o => o.id === orgFilter);
  const ctxCounts = orgCounts(orgFilter);

  return (
    <div className={"app " + (showRail ? "with-rail" : "")} data-screen-label={`Command Center — ${pageTitle}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">G</div>
          <div>
            <div className="brand-name">GrantIQ</div>
            <div className="brand-sub">Command Center</div>
          </div>
        </div>
        <div className="crumbs">
          <span className="now">{pageTitle}</span>
        </div>
        <div className="spacer" />
        <div className="theme-toggle" role="tablist" aria-label="Theme">
          <button className={tweaks.theme === "light" ? "active" : ""} onClick={() => setTweak("theme", "light")} title="Light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
          </button>
          <button className={tweaks.theme === "dark" ? "active" : ""} onClick={() => setTweak("theme", "dark")} title="Dark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          </button>
        </div>
        <div className={"agent-pulse " + (liveAgents > 0 ? "" : "idle")}>
          <span className="pulse-dot" />
          {liveAgents > 0 ? `${liveAgents} agent task${liveAgents===1?"":"s"} live` : "agents idle"}
        </div>
      </header>

      <aside className="sidebar">
        <div className="org-picker">
          <div className="label">Viewing</div>
          {orgs.map((o, i) => {
            const c = orgCounts(o.id);
            return (
              <button key={o.id} className={"org-pick " + (o.id === "all" ? "all " : "") + (orgFilter === o.id ? "active" : "")} onClick={() => setOrgFilter(o.id)}>
                <span className="swatch" style={o.id === "all" ? null : {background: `var(--org-accent, var(--accent))`, ...(o.id === "holigenix_healthcare" && {background: "oklch(0.78 0.13 195)"}), ...(o.id === "k1_management" && {background: "oklch(0.78 0.16 38)"}), ...(o.id === "owner_nonprofit" && {background: "oklch(0.78 0.13 290)"})}}>{o.letter}</span>
                <span style={{textAlign:"left"}}>{o.short}</span>
                <span className="count">{c.grants}</span>
              </button>
            );
          })}
        </div>
        <div className="nav-group">
          <div className="label">Operate</div>
          <NavItem id="inbox"    label="Inbox"    icon={I.inbox}    badge={counts.inbox}   page={page} onNav={onNav} accent />
          <NavItem id="pipeline" label="Pipeline" icon={I.pipeline} badge={counts.pipeline} page={page} onNav={onNav} muted />
          <NavItem id="drafts"   label="Drafts"   icon={I.drafts}   badge={counts.drafts}  page={page} onNav={onNav} accent />
          <NavItem id="sessions" label="Sessions" icon={I.sessions} badge={counts.sessions} page={page} onNav={onNav} accent />
          <NavItem id="calendar" label="Calendar" icon={I.clock}    page={page} onNav={onNav} />
        </div>
        <div className="nav-group">
          <div className="label">Documents</div>
          <NavItem id="vault"     label="Vault"     icon={I.vault} badge={counts.vault}   page={page} onNav={onNav} muted />
          <NavItem id="templates" label="Templates" icon={I.notes} page={page} onNav={onNav} />
        </div>
        <div className="nav-group">
          <div className="label">Discovery</div>
          <NavItem id="sources"     label="Sources"     icon={I.globe}  page={page} onNav={onNav} />
          <NavItem id="watchlists"  label="Watchlists"  icon={I.search} page={page} onNav={onNav} />
          <NavItem id="dismissed"   label="Dismissed"   icon={I.alert}  page={page} onNav={onNav} />
        </div>
        <div className="nav-group">
          <div className="label">Relationships</div>
          <NavItem id="funders"     label="Funders"     icon={I.bot}    page={page} onNav={onNav} />
          <NavItem id="submissions" label="Submissions" icon={I.check}  page={page} onNav={onNav} />
        </div>
        <div className="nav-group">
          <div className="label">Intelligence</div>
          <NavItem id="chat"     label="Chat"     icon={I.chat}     page={page} onNav={onNav} />
          <NavItem id="notes"    label="Notes"    icon={I.notes}    page={page} onNav={onNav} />
        </div>
        <div className="nav-group">
          <div className="label">System</div>
          <NavItem id="settings" label="Settings" icon={I.settings} page={page} onNav={onNav} />
        </div>
        <div className="sidebar-footer">
          <div className="row"><span>API</span><span className="v" style={{color:"var(--green)"}}>● connected</span></div>
          <div className="row"><span>Model</span><span className="v">claude-sonnet</span></div>
          <div className="row"><span>Build</span><span className="v">v2.4.1</span></div>
        </div>
      </aside>

      <main className="work">
        <div className="org-context">
          <div className="swatch" style={orgFilter === "all" ? {background:"linear-gradient(135deg, oklch(0.78 0.13 195), oklch(0.78 0.16 38), oklch(0.78 0.13 290))"} : orgFilter === "holigenix_healthcare" ? {background:"oklch(0.78 0.13 195)"} : orgFilter === "k1_management" ? {background:"oklch(0.78 0.16 38)"} : {background:"oklch(0.78 0.13 290)"}}>{activeOrg.letter}</div>
          <div>
            <div className="lbl">Active business</div>
            <div className="name">{activeOrg.label}</div>
          </div>
          <div className="spacer" />
          <div className="meta">
            <span><span className="num">{ctxCounts.grants}</span> active grants</span>
            <span><span className="num">{ctxCounts.attention}</span> need attention</span>
          </div>
          <div className={"agent-pulse " + (liveAgents > 0 ? "" : "idle")}>
            <span className="pulse-dot" />
            {liveAgents > 0 ? `${liveAgents} agent task${liveAgents===1?"":"s"} live` : "agents idle"}
          </div>
        </div>
        <div className="work-inner">
          {page === "inbox"    && <window.InboxView    orgFilter={orgFilter} onNav={onNav} />}
          {page === "pipeline" && <window.PipelineView orgFilter={orgFilter} focusGrantId={navCtx.grantId} onNav={onNav} />}
          {page === "grant"    && <window.GrantDetailView grantId={navCtx.grantId} onNav={onNav} onSetOrg={setOrgFilter} />}
          {page === "drafts"   && <window.DraftsView   orgFilter={orgFilter} focusDraftId={navCtx.draftId} onNav={onNav} />}
          {page === "sessions" && <window.SessionsView orgFilter={orgFilter} focusSessionId={navCtx.sessionId} />}
          {page === "calendar" && <window.CalendarView orgFilter={orgFilter} onNav={onNav} />}
          {page === "vault"    && <window.VaultView    orgFilter={orgFilter} onSetOrg={setOrgFilter} onNav={onNav} />}
          {page === "templates"&& <window.TemplatesView orgFilter={orgFilter} />}
          {page === "sources"  && <window.SourcesView  orgFilter={orgFilter} />}
          {page === "watchlists" && <window.WatchlistsView orgFilter={orgFilter} onNav={onNav} />}
          {page === "dismissed"  && <window.DismissedView  orgFilter={orgFilter} />}
          {page === "funders"    && <window.FundersView    orgFilter={orgFilter} onNav={onNav} />}
          {page === "submissions"&& <window.SubmissionsView orgFilter={orgFilter} />}
          {page === "chat"     && <window.ChatView />}
          {page === "notes"    && <window.NotesView />}
          {page === "settings" && <window.SettingsView />}
        </div>
      </main>

      {showRail && (
        <aside className="right-rail">
          <div className="rail-section">
            <h4>Alerts <span className="count">{ALERTS.length}</span></h4>
            {ALERTS.map(a => (
              <div key={a.id} className={"alert " + a.severity} onClick={() => {
                if (a.session_id) onNav("sessions", { sessionId: a.session_id });
                else if (a.draft_id) onNav("drafts", { draftId: a.draft_id });
                else if (a.page) onNav(a.page);
              }}>
                <div className="strip" />
                <div className="body">
                  <div className="title">{a.title}</div>
                  <div className="desc">{a.body}</div>
                  <div className="when">{relTime(a.created)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rail-section">
            <h4>Agent activity <span className="count">live</span></h4>
            {AGENT_ACTIVITY.map(act => (
              <div key={act.id} className="activity-row">
                <span className="when">{relTime(act.t)}</span>
                <span className={"marker " + act.agent} />
                <span className="text">
                  <span className="agent-tag">{act.agent}</span>
                  {act.text}
                </span>
              </div>
            ))}
          </div>
        </aside>
      )}

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection title="Layout">
          <window.TweakToggle label="Right rail (alerts + agent activity)" value={tweaks.showRightRail} onChange={v => setTweak("showRightRail", v)} />
          <window.TweakRadio  label="Density" value={tweaks.density} onChange={v => setTweak("density", v)} options={[
            { label: "Compact",     value: "compact" },
            { label: "Comfortable", value: "comfortable" },
            { label: "Spacious",    value: "spacious" },
          ]} />
        </window.TweakSection>
        <window.TweakSection title="Accent">
          <window.TweakSlider label="Accent hue (oklch)" value={tweaks.accentHue} min={0} max={360} step={1} onChange={v => setTweak("accentHue", v)} />
        </window.TweakSection>
        <window.TweakSection title="Quick jump">
          <window.TweakButton label="→ Inbox"    onClick={() => onNav("inbox")} />
          <window.TweakButton label="→ Pipeline" onClick={() => onNav("pipeline")} />
          <window.TweakButton label="→ Calendar" onClick={() => onNav("calendar")} />
          <window.TweakButton label="→ Vault" onClick={() => onNav("vault")} />
          <window.TweakButton label="→ Sources" onClick={() => onNav("sources")} />
          <window.TweakButton label="→ Funders" onClick={() => onNav("funders")} />
          <window.TweakButton label="→ Sessions (gated)" onClick={() => onNav("sessions")} />
          <window.TweakButton label="→ Chat"     onClick={() => onNav("chat")} />
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

function NavItem({ id, label, icon, badge, page, onNav, accent, muted }) {
  return (
    <button className={"nav-item " + (page === id ? "active" : "")} onClick={() => onNav(id)}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {badge > 0 && <span className={"badge " + (muted ? "muted" : "")} style={accent ? null : muted ? null : null}>{badge}</span>}
    </button>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
