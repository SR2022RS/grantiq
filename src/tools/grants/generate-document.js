// generate_document — produce a starter document for a missing 'draftable' vault entry.
//
// Flow:
//  1. Look up the doc type's metadata in the catalog.
//  2. If draftable: read the org-specific Markdown template, run token substitution,
//     persist to document_vault as status='drafted' with draft_content + drafted_at.
//  3. If request: render the request email template — caller decides what to do with it.
//  4. If gather: return the gather hint with org tokens substituted.
//
// Returns { ok, doc_type, template_kind, draft_content, doc_id?, message }.

import { getSupabase } from '../../lib/supabase.js';
import {
  getDocTypeMetadata,
  resolveDocType,
  readTemplateForOrgAsync,
  renderTemplate,
} from '../../lib/document-catalog.js';

export const generateDocumentSchema = {
  name: 'generate_document',
  description: 'Generate a starter document for a missing vault entry. For draftable docs, produces a Markdown draft with [BRACKETED PLACEHOLDERS] for the user to fill in. For request docs, produces an email/message to send to the issuing party. For gather docs, returns instructions on where to find it. Persists drafts to document_vault as status=drafted.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: {
        type: 'string',
        description: 'Org ID — e.g., holigenix_healthcare, k1_management, owner_nonprofit',
      },
      doc_type: {
        type: 'string',
        description: 'Document type — must match a key in the document catalog (e.g., board_list, cv_operations_lead, w9, letter_of_support_community, irs_determination, bank_reference, evv_compliance).',
      },
      grant_id: {
        type: 'string',
        description: 'Optional — grant context if drafting for a specific application.',
      },
    },
    required: ['org_id', 'doc_type'],
  },
};

export async function generateDocument({ org_id, doc_type, grant_id }) {
  const canonical = resolveDocType(doc_type);
  const meta = getDocTypeMetadata(canonical);
  if (!meta) {
    return {
      ok: false,
      error: `Unknown doc_type: ${doc_type}. Not in catalog.`,
    };
  }

  const supabase = getSupabase();

  // Pull org profile for token substitution
  const { data: org, error: orgErr } = await supabase
    .from('orgs')
    .select('data')
    .eq('id', org_id)
    .single();
  if (orgErr || !org) {
    return { ok: false, error: `org not found: ${org_id}` };
  }
  const orgData = org.data || {};

  // Find the matching vault row (so we can update it). May not exist yet.
  const { data: vaultRow } = await supabase
    .from('document_vault')
    .select('id, status')
    .eq('org_id', org_id)
    .eq('doc_type', doc_type)
    .maybeSingle();

  // ─── DRAFTABLE ──────────────────────────────────────────────────────────
  if (meta.template_kind === 'draftable') {
    const template = await readTemplateForOrgAsync(supabase, org_id, canonical);
    if (!template) {
      return {
        ok: false,
        error: `No draftable template found for (${org_id}, ${canonical}). Add one at workspace/templates/${org_id}/${canonical}.md, or to the org_templates DB table.`,
        template_kind: 'draftable',
      };
    }

    const draft = renderTemplate(template, orgData);
    const now = new Date().toISOString();

    if (vaultRow) {
      const { error: upErr } = await supabase
        .from('document_vault')
        .update({
          status: 'drafted',
          template_kind: 'draftable',
          draft_content: draft,
          drafted_at: now,
        })
        .eq('id', vaultRow.id);
      if (upErr) {
        return { ok: false, error: `vault update failed: ${upErr.message}` };
      }
      return {
        ok: true,
        doc_type: canonical,
        template_kind: 'draftable',
        draft_content: draft,
        doc_id: vaultRow.id,
        message: `Drafted ${meta.title} for ${org_id}. Review at /vault, fill [BRACKETED PLACEHOLDERS] in your editor, save as PDF, upload as final.`,
      };
    } else {
      // No vault row exists for this doc_type — create one in 'drafted' state
      const { data: created, error: insErr } = await supabase
        .from('document_vault')
        .insert({
          org_id,
          doc_type: canonical,
          doc_name: meta.title,
          description: `Auto-drafted by Grants agent on ${now.slice(0, 10)}.`,
          status: 'drafted',
          template_kind: 'draftable',
          draft_content: draft,
          drafted_at: now,
        })
        .select('id')
        .single();
      if (insErr) {
        return { ok: false, error: `vault insert failed: ${insErr.message}` };
      }
      return {
        ok: true,
        doc_type: canonical,
        template_kind: 'draftable',
        draft_content: draft,
        doc_id: created.id,
        message: `Drafted ${meta.title} for ${org_id} (new vault entry). Review at /vault, fill [BRACKETED PLACEHOLDERS], save as PDF, upload as final.`,
      };
    }
  }

  // ─── REQUEST — render the request email/message ─────────────────────────
  if (meta.template_kind === 'request') {
    const requestText = renderTemplate(meta.request_template || '', orgData);
    return {
      ok: true,
      doc_type: canonical,
      template_kind: 'request',
      request_to: meta.request_to,
      draft_content: requestText,
      message: `${meta.title} must be issued by ${meta.request_to}. Use this template to request it. (Not persisted to vault — send the request, then upload the response when received.)`,
    };
  }

  // ─── GATHER — instructions on where to find it ──────────────────────────
  if (meta.template_kind === 'gather') {
    const hint = renderTemplate(meta.gather_hint || '', orgData);
    return {
      ok: true,
      doc_type: canonical,
      template_kind: 'gather',
      draft_content: hint,
      message: `${meta.title} is a "gather" doc — you already have it somewhere. ${hint}`,
    };
  }

  return {
    ok: false,
    error: `Unknown template_kind: ${meta.template_kind}`,
  };
}
