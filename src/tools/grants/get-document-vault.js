import { getSupabase } from '../../lib/supabase.js';

export const getDocumentVaultSchema = {
  name: 'get_document_vault',
  description: 'List documents in an org\'s vault. Returns metadata only (URLs, not content).',
  input_schema: { type: 'object', properties: { org_id: { type: 'string' } }, required: ['org_id'] },
};

export async function getDocumentVault({ org_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('document_vault')
    .select('id, doc_name, doc_type, status, required_for, file_url, expiry_date')
    .eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, documents: data || [] };
}
