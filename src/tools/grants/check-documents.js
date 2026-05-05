import { getSupabase } from '../../lib/supabase.js';

export const checkDocumentsSchema = {
  name: 'check_documents',
  description: 'Compare an org\'s document_vault against documents typically required for a grant. Returns ready/missing breakdown.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      grant_id: { type: 'string', description: 'Optional — if provided, also flags grant-specific docs' },
    },
    required: ['org_id'],
  },
};

export async function checkDocuments({ org_id, grant_id }) {
  const supabase = getSupabase();
  const { data: docs, error } = await supabase
    .from('document_vault')
    .select('doc_name, doc_type, status, required_for')
    .eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };

  const total = docs.length;
  const uploaded = docs.filter((d) => d.status === 'uploaded').length;
  const missing = docs
    .filter((d) => d.status === 'missing')
    .map((d) => ({ doc_name: d.doc_name, doc_type: d.doc_type, required_for: d.required_for }));

  return {
    ok: true,
    org_id,
    grant_id: grant_id || null,
    total,
    uploaded,
    readiness_percent: total ? Math.round((uploaded / total) * 100) : 0,
    missing,
  };
}
