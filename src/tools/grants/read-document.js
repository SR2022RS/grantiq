import { getSupabase } from '../../lib/supabase.js';

export const readDocumentSchema = {
  name: 'read_document',
  description: 'Fetch a single document\'s text content (when narrative drafting needs to reference specific contents).',
  input_schema: { type: 'object', properties: { doc_id: { type: 'string' } }, required: ['doc_id'] },
};

export async function readDocument({ doc_id }) {
  const supabase = getSupabase();
  const { data: doc, error } = await supabase
    .from('document_vault')
    .select('doc_name, file_url, doc_type')
    .eq('id', doc_id)
    .single();
  if (error || !doc) return { ok: false, error: error?.message || 'not found' };
  if (!doc.file_url) return { ok: false, error: 'document has no file_url' };

  // Download file (PDF text extraction is out of scope; return URL + name + type for now)
  // The agent can request a specific page or summary if needed in a future iteration.
  return { ok: true, doc_id, doc_name: doc.doc_name, doc_type: doc.doc_type, file_url: doc.file_url, note: 'Full text extraction not implemented in R1; URL returned for reference' };
}
