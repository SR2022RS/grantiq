-- ============================================
-- GrantIQ — Supabase Database Setup
-- ============================================
-- Run this SQL in your Supabase SQL Editor to create all required tables.
-- Dashboard URL: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- ── ORGANIZATIONS ──
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  org_type TEXT,
  legal_structure TEXT,
  regions TEXT,
  certifications JSONB DEFAULT '[]',
  mission TEXT,
  naics_codes TEXT,
  email_to TEXT,
  drive_folder_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── AGENTS ──
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'error', 'disabled')),
  last_run_at TIMESTAMPTZ,
  last_result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed agents
INSERT INTO agents (id, name, role, status) VALUES
  ('director', 'Director', 'Grant Agency Director — orchestrates all agents', 'idle'),
  ('finder', 'Finder', 'Grant Discovery & Research — web search, YouTube, portals', 'idle'),
  ('writer', 'Writer', 'Application Narrative — drafts grant applications', 'idle'),
  ('analyst', 'Analyst', 'Eligibility Analysis — match scoring, cert advantages', 'idle'),
  ('tracker', 'Tracker', 'Deadline Tracking — pipeline management, status tracking', 'idle'),
  ('monitor', 'Monitor', 'Grant Monitoring — alerts, new opportunities, changes', 'idle'),
  ('reporter', 'Reporter', 'Reporting — email, Drive, dashboard data', 'idle')
ON CONFLICT (id) DO NOTHING;

-- ── GRANT OPPORTUNITIES ──
CREATE TABLE IF NOT EXISTS grant_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  funder TEXT,
  region TEXT,
  amount TEXT,
  deadline DATE,
  url TEXT,
  eligibility JSONB DEFAULT '[]',
  certification_advantage TEXT,
  match_score INTEGER DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  description TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'analyzing', 'eligible', 'drafting', 'review', 'submitted', 'awarded', 'rejected', 'expired', 'skipped')),
  source TEXT,
  applied_at TIMESTAMPTZ,
  awarded_at TIMESTAMPTZ,
  follow_up_date DATE,
  notes TEXT,
  created_by TEXT DEFAULT 'finder',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grants_org ON grant_opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_grants_score ON grant_opportunities(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_grants_deadline ON grant_opportunities(deadline);
CREATE INDEX IF NOT EXISTS idx_grants_status ON grant_opportunities(status);

-- ── APPLICATION DRAFTS ──
CREATE TABLE IF NOT EXISTS application_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  grant_opportunity_id UUID REFERENCES grant_opportunities(id),
  grant_name TEXT,
  narrative TEXT,
  framework TEXT,
  word_count INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'final', 'submitted')),
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT 'writer',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drafts_org ON application_drafts(org_id);

-- ── GRANT RUNS (run history for dashboard) ──
CREATE TABLE IF NOT EXISTS grant_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  run_date TIMESTAMPTZ DEFAULT NOW(),
  grants_found INTEGER DEFAULT 0,
  grants_emailed BOOLEAN DEFAULT FALSE,
  drive_uploaded BOOLEAN DEFAULT FALSE,
  youtube_videos INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  metadata JSONB DEFAULT '{}',
  created_by TEXT DEFAULT 'reporter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runs_org ON grant_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_runs_date ON grant_runs(run_date DESC);

-- ── YOUTUBE INTEL ──
CREATE TABLE IF NOT EXISTS youtube_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  video_id TEXT,
  title TEXT,
  channel TEXT,
  summary TEXT,
  transcript_excerpt TEXT,
  opportunities JSONB DEFAULT '[]',
  insights JSONB DEFAULT '[]',
  url TEXT,
  created_by TEXT DEFAULT 'finder',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_org ON youtube_intel(org_id);

-- ── DEADLINE ALERTS ──
CREATE TABLE IF NOT EXISTS deadline_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  grant_id UUID REFERENCES grant_opportunities(id),
  grant_name TEXT,
  deadline DATE,
  urgency TEXT DEFAULT 'info' CHECK (urgency IN ('urgent', 'approaching', 'upcoming', 'info')),
  message TEXT,
  notified BOOLEAN DEFAULT FALSE,
  created_by TEXT DEFAULT 'tracker',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_org ON deadline_alerts(org_id);
CREATE INDEX IF NOT EXISTS idx_alerts_urgency ON deadline_alerts(urgency);

-- ── AGENT ACTIVITY LOG ──
CREATE TABLE IF NOT EXISTS agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON agent_activity_log(created_at DESC);

-- ── ROW LEVEL SECURITY (optional — enable if using anon key) ──
-- ALTER TABLE grant_opportunities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE application_drafts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE grant_runs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE youtube_intel ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE deadline_alerts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE agent_activity_log ENABLE ROW LEVEL SECURITY;

-- ── UPDATED_AT TRIGGER ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_grants_updated
  BEFORE UPDATE ON grant_opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_drafts_updated
  BEFORE UPDATE ON application_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_orgs_updated
  BEFORE UPDATE ON orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_agents_updated
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
