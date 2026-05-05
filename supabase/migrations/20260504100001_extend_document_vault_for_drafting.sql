-- Extends document_vault with draft generation support.
-- template_kind classifies how a missing doc gets resolved:
--   'draftable'      — agent can generate a starter with [BRACKETED PLACEHOLDERS]
--   'request'        — external authority issues it (IRS letter, certifications, bank ref)
--   'gather'         — exists somewhere; user finds and uploads
--   'external_auth'  — third-party verification (SAM.gov, NPI registry — need login)
--   null             — not yet classified

alter table document_vault
  add column if not exists template_kind text
    check (template_kind in ('draftable', 'request', 'gather', 'external_auth') or template_kind is null);

-- Markdown content of the generated draft. Populated when status='drafted'.
alter table document_vault
  add column if not exists draft_content text;

-- When the draft was generated.
alter table document_vault
  add column if not exists drafted_at timestamptz;

-- Allow 'drafted' as a status.
alter table document_vault drop constraint if exists document_vault_status_check;
alter table document_vault
  add constraint document_vault_status_check
    check (status in ('uploaded', 'missing', 'drafted', 'expired'));

create index if not exists document_vault_kind_idx
  on document_vault (org_id, template_kind, status) where status in ('missing', 'drafted');
