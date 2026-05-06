// POST /api/grants/draft
// Body: { grant_id, org_id }
// Response: { ok, draft_id, narrative, message } | { ok: false, error }
//
// One-click "Draft application" — runs draft_narrative then save_draft.
// Sets the grant_opportunities row to status='drafting' so the Pipeline
// row reflects the agent is working it.

import { draftNarrative } from '../../src/tools/grants/draft-narrative.js';
import { saveDraft } from '../../src/tools/grants/save-draft.js';
import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { grant_id, org_id } = req.body || {};
  if (!grant_id || !org_id) {
    return res.status(400).json({ error: 'grant_id and org_id required' });
  }

  try {
    const result = await draftNarrative({ grant_id, org_id });
    if (!result.ok) return res.status(500).json({ ok: false, error: result.error });

    const saved = await saveDraft({
      grant_id, org_id,
      narrative: result.narrative,
      status: 'draft',
    });
    if (!saved.ok) return res.status(500).json({ ok: false, error: saved.error });

    // Bump the grant's status so Pipeline reflects it
    const supabase = getSupabase();
    await supabase
      .from('grant_opportunities')
      .update({ status: 'drafting' })
      .eq('id', grant_id);

    return res.status(200).json({
      ok: true,
      draft_id: saved.draft_id,
      narrative: result.narrative,
      message: 'Draft created. Open the Drafts tab to review.',
    });
  } catch (e) {
    console.error('[grants/draft] error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
