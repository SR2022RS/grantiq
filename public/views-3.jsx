// Chat + Notes + Settings views
const { useState: useState3, useRef: useRef3, useEffect: useEffect3 } = React;

function ChatView() {
  const { CHAT_HISTORY } = window.MOCK;
  const { md, relTime } = window.Helpers;
  const I = window.IconSet;

  // Real conversation persistence — id stored in localStorage so chat survives reloads
  const [convId, setConvId] = useState3(() => localStorage.getItem("grantiq_conv_id") || null);
  const [history, setHistory] = useState3([]);
  const [input, setInput] = useState3("");
  const [thinking, setThinking] = useState3(false);
  const [iter, setIter] = useState3(0);
  const [conversations, setConversations] = useState3([]);
  const streamRef = useRef3(null);

  // Fetch conversation list once + active conversation history if we have an id
  useEffect3(() => {
    fetch("/api/grants/conversations?user_chat_id=rodney")
      .then(r => r.ok ? r.json() : { conversations: [] })
      .then(d => {
        const list = (d.conversations || []).map((c, i) => ({
          id: c.id,
          title: i === 0 ? "Active conversation" : "Earlier — " + new Date(c.last_message_at).toLocaleDateString(),
          when: relTime(c.last_message_at),
          active: c.id === convId,
        }));
        setConversations(list);
      })
      .catch(() => { /* fall back to empty */ });
  }, [convId]);

  useEffect3(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [history, thinking]);

  const send = async () => {
    if (!input.trim() || thinking) return;
    const userText = input;
    const userMsg = { id: "u" + Date.now(), role: "user", text: userText };
    setHistory(h => [...h, userMsg]);
    setInput("");
    setThinking(true);
    setIter(1);

    try {
      const r = await fetch("/api/grants/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversation_id: convId,
          user_chat_id: "rodney",
        }),
      });
      const j = await r.json();

      if (!r.ok) {
        setHistory(h => [...h, {
          id: "e" + Date.now(),
          role: "assistant",
          text: `Error ${r.status}: ${j.error || "unknown"}`,
          blocks: [],
        }]);
      } else {
        // Persist conversation_id for next message
        if (j.conversation_id && j.conversation_id !== convId) {
          setConvId(j.conversation_id);
          localStorage.setItem("grantiq_conv_id", j.conversation_id);
        }
        // Build display blocks from telemetry tools_invoked
        const blocks = (j.telemetry?.tools_invoked || []).map(t => ({
          kind: "tool",
          tool: t.name,
          args: t.input || {},
          result: t.error ? `Error: ${t.error}` : `ok · ${t.latency_ms}ms`,
        }));
        setHistory(h => [...h, {
          id: "a" + Date.now(),
          role: "assistant",
          text: j.text || "(no response text)",
          blocks,
        }]);
        setIter(j.telemetry?.iterations || 1);
      }
    } catch (e) {
      setHistory(h => [...h, {
        id: "e" + Date.now(),
        role: "assistant",
        text: "Network error: " + e.message,
        blocks: [],
      }]);
    } finally {
      setThinking(false);
    }
  };

  const newConversation = () => {
    setConvId(null);
    localStorage.removeItem("grantiq_conv_id");
    setHistory([]);
  };

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Chat</h1>
          <div className="sub">Grants Agent · model claude-sonnet · persistent history per <span className="mono">user_chat_id=rodney</span></div>
        </div>
        <div className="actions">
          <button className="btn btn-sm" onClick={newConversation}>New conversation</button>
        </div>
      </div>

      <div className="chat-grid">
        <div className="chat-rail">
          {conversations.map(c => (
            <div key={c.id} className={"conv-item " + (c.active ? "active" : "")}>
              <div className="title">{c.title}</div>
              <div className="when">{c.when}</div>
            </div>
          ))}
        </div>

        <div className="chat-pane">
          <div className="chat-stream" ref={streamRef}>
            {history.map(m => (
              <Message key={m.id} m={m} />
            ))}
            {thinking && (
              <div className="msg assistant">
                <div className="who">Grants Agent</div>
                <div className="bubble" style={{display:"flex", alignItems:"center", gap:10}}>
                  <span className="iter-indicator"><span className="dot" /> Iteration {iter} of 8</span>
                  <span className="muted" style={{fontSize:11.5}}>running tool · search_grants</span>
                </div>
              </div>
            )}
          </div>
          <div className="composer">
            <textarea
              placeholder="Ask the Grants Agent…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(); }}
            />
            <div className="row">
              <span className="hint"><span className="kbd">⌘</span> <span className="kbd">↵</span> to send · agent has access to grants, drafts, vault</span>
              <button className="btn btn-primary btn-sm" onClick={send} disabled={thinking || !input.trim()}>
                <span>{I.send}</span> Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({ m }) {
  const { md } = window.Helpers;
  const [openTools, setOpenTools] = useState3({});
  return (
    <div className={"msg " + m.role}>
      <div className="who">{m.role === "user" ? "Rodney" : "Grants Agent"}</div>
      <div className="bubble">
        {m.text && (
          m.role === "user"
            ? <div className="user-text">{m.text}</div>
            : <div className="markdown-body" dangerouslySetInnerHTML={md(m.text)} />
        )}
        {m.blocks && m.blocks.map((b, i) => (
          b.kind === "tool" ? (
            <div key={i} className="tool-block">
              <div className={"tool-head " + (openTools[i] ? "open" : "")} onClick={() => setOpenTools(o => ({...o, [i]: !o[i]}))}>
                <span style={{width:12, height:12}}>{window.IconSet.chev}</span>
                <span className="tname">{b.tool}</span>
                <span className="args">{JSON.stringify(b.args)}</span>
              </div>
              {openTools[i] && <div className="tool-body">{b.result}</div>}
            </div>
          ) : (
            <div key={i} className="markdown-body" style={{marginTop: 8}} dangerouslySetInnerHTML={md(b.body)} />
          )
        ))}
      </div>
    </div>
  );
}

function NotesView() {
  const { NOTES } = window.MOCK;
  const { relTime } = window.Helpers;
  const [agentFilter, setAgentFilter] = useState3("all");
  const [tagFilter, setTagFilter] = useState3("all");

  const tags = Array.from(new Set(NOTES.map(n => n.tag)));
  const list = NOTES.filter(n =>
    (agentFilter === "all" || n.agent === agentFilter) &&
    (tagFilter === "all" || n.tag === tagFilter)
  ).sort((a, b) => new Date(b.created) - new Date(a.created));

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Agent Notes</h1>
          <div className="sub">Layer-3 learnings written by agents over time · read-only</div>
        </div>
      </div>

      <div className="filterbar">
        <div className="group">
          <label>Agent</label>
          {["all","grants","playwright"].map(a => (
            <button key={a} className={"chip " + (agentFilter === a ? "active" : "")} onClick={() => setAgentFilter(a)}>{a}</button>
          ))}
        </div>
        <div className="group">
          <label>Tag</label>
          <button className={"chip " + (tagFilter === "all" ? "active" : "")} onClick={() => setTagFilter("all")}>all</button>
          {tags.map(t => (
            <button key={t} className={"chip " + (tagFilter === t ? "active" : "")} onClick={() => setTagFilter(t)}>{t}</button>
          ))}
        </div>
      </div>

      {list.map(n => (
        <div key={n.id} className="note-card">
          <div className="head">
            <span className={"agent-tag " + n.agent}>{n.agent}</span>
            <span className="tag-pill">#{n.tag}</span>
            <span className="conf">confidence {Math.round(n.confidence * 100)}%</span>
          </div>
          <div className="body">{n.text}</div>
          <div className="when">{relTime(n.created)} · {new Date(n.created).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</div>
        </div>
      ))}

      {list.length === 0 && (
        <div className="empty">
          <div className="title">No notes match these filters</div>
        </div>
      )}
    </div>
  );
}

function SettingsView() {
  const integrations = [
    { name: "Supabase",          status: "connected", detail: "zamokpkpneedvluthsem.supabase.co" },
    { name: "OpenAI / Anthropic", status: "connected", detail: "claude-sonnet-4 · gpt-4o fallback" },
    { name: "Playwright",        status: "connected", detail: "Chromium · headed · 4 workers" },
    { name: "HHAeXchange",       status: "connected", detail: "EVV log pull · last sync 06:14 EST" },
    { name: "DocuSign",          status: "connected", detail: "envelope.create scope" },
    { name: "SAM.gov",           status: "expiring",  detail: "UEI active · expires 2026-11-30" },
    { name: "Telegram bot",      status: "retired",   detail: "Replaced by this portal" },
  ];

  const crons = [
    { name: "Daily discovery",   schedule: "0 7 * * *",   last: "2026-05-04 07:00 EST", next: "2026-05-05 07:00 EST" },
    { name: "Weekly readiness",  schedule: "0 8 * * 1",   last: "2026-05-04 08:00 EST", next: "2026-05-11 08:00 EST" },
    { name: "Cert expiry sweep", schedule: "0 9 1 * *",   last: "2026-05-01 09:00 EST", next: "2026-06-01 09:00 EST" },
  ];

  return (
    <div>
      <div className="page-title">
        <div><h1>Settings</h1><div className="sub">Read-only system status · environment variables and persona files live in the repo</div></div>
      </div>

      <div className="card" style={{marginBottom: 14}}>
        <div className="card-head"><h3>Integrations</h3><span className="meta">{integrations.length} connections</span></div>
        <table className="tbl">
          <tbody>
            {integrations.map(i => (
              <tr key={i.name} style={{cursor:"default"}}>
                <td className="strong" style={{width:200}}>{i.name}</td>
                <td><span className={"pill pill-" + (i.status === "connected" ? "ready" : i.status === "expiring" ? "warn" : "low")}>{i.status}</span></td>
                <td className="muted mono" style={{fontSize:11.5}}>{i.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><h3>Cron schedule</h3></div>
        <table className="tbl">
          <thead><tr><th>Job</th><th>Schedule</th><th>Last run</th><th>Next run</th></tr></thead>
          <tbody>
            {crons.map(c => (
              <tr key={c.name} style={{cursor:"default"}}>
                <td className="strong">{c.name}</td>
                <td className="mono">{c.schedule}</td>
                <td className="mono muted">{c.last}</td>
                <td className="mono">{c.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.ChatView = ChatView;
window.NotesView = NotesView;
window.SettingsView = SettingsView;
