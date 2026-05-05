import { getSupabase } from '../../lib/supabase.js';

export const recordNoteSchema = {
  name: 'record_note',
  description: 'Persist a learned fact (Layer 3 memory). Use when you discover a non-obvious insight that will help future work — agency reviewer preferences, form quirks, eligibility nuances. Do NOT record facts already in the org profile or trivially Google-able.',
  input_schema: {
    type: 'object',
    properties: {
      note: { type: 'string', description: 'The fact to record' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for retrieval' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How confident you are' },
      source: { type: 'string', description: 'Optional reference (conversation_id, session_id, etc.)' },
      supersedes: { type: 'string', description: 'Optional UUID of a note this replaces' },
    },
    required: ['note', 'tags', 'confidence'],
  },
};

export function makeRecordNote(agentId) {
  return async function recordNote({ note, tags, confidence, source, supersedes }) {
    const supabase = getSupabase();

    if (supersedes) {
      await supabase
        .from('agent_notes')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', supersedes);
    }

    const { data, error } = await supabase
      .from('agent_notes')
      .insert({
        agent_id: agentId,
        note,
        tags: tags || [],
        confidence: confidence || 'medium',
        source: source || null,
        supersedes: supersedes || null,
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, note_id: data.id };
  };
}
