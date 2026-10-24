// Shared helpers for client document uploads.
//
// Files live in PRIVATE storage buckets and are only ever handed out as
// short-lived signed URLs by server routes:
//   - new uploads:     bucket 'vault-docs', path in document_vault.storage_path
//   - legacy uploads:  bucket 'grant-documents', path parsed from the old
//                      public URL kept in document_vault.file_url
import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';

export const UPLOAD_BUCKET = 'vault-docs';
export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (bucket limit)
export const SIGNED_URL_TTL = 120;         // seconds

export const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'text/plain', 'text/csv', 'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const EXT_MIME = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  txt: 'text/plain', csv: 'text/csv', md: 'text/markdown',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function normalizeMime(mime, filename) {
  const m = String(mime || '').toLowerCase().trim();
  if (ALLOWED_MIME.has(m)) return m;
  const ext = String(filename || '').toLowerCase().split('.').pop();
  return EXT_MIME[ext] || null;
}

export function safeFilename(name) {
  return String(name || 'file').replace(/[^\w.\- ]/g, '_').slice(0, 160) || 'file';
}

// Where does this document_vault row's file live? -> { bucket, path } | null
export function resolveFile(row) {
  if (!row) return null;
  if (row.storage_path) return { bucket: UPLOAD_BUCKET, path: row.storage_path };
  const u = row.file_url;
  if (!u) return null;
  const m = String(u).match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  if (!/^https?:/i.test(u)) return { bucket: UPLOAD_BUCKET, path: u };
  return null;
}

export function fileNameOf(row) {
  const f = resolveFile(row);
  if (!f) return null;
  const base = f.path.split('/').pop() || '';
  return base.replace(/^(?:[a-z0-9_]+_)?\d{12,}_/, '') || base;
}

export async function signedUrlFor(row, { download = false, ttl = SIGNED_URL_TTL } = {}) {
  const f = resolveFile(row);
  if (!f) return { error: 'this document has no uploaded file' };
  const opts = download ? { download: fileNameOf(row) || true } : undefined;
  const { data, error } = await getSupabase().storage.from(f.bucket).createSignedUrl(f.path, ttl, opts);
  if (error) return { error: error.message };
  return { url: data.signedUrl };
}

export function newToken() {
  return crypto.randomBytes(24).toString('base64url'); // 192 bits, unguessable
}

// Resolve the caller's org: a valid client link token, or (admin only) an explicit org id.
export async function resolveOrg({ token, org, admin }) {
  const supabase = getSupabase();
  if (token) {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { error: 'invalid link', status: 404 };
    const { data, error } = await supabase
      .from('upload_links').select('org_id, revoked_at').eq('token', token).maybeSingle();
    if (error) return { error: 'link lookup failed', status: 500 };
    if (!data || data.revoked_at) return { error: 'This upload link is not valid. Ask for a new one.', status: 404 };
    return { orgId: data.org_id, viaToken: true };
  }
  if (org && admin) return { orgId: String(org), viaToken: false };
  return { error: 'auth required', status: 401 };
}

// Standard checklist for a new client: the generic grant document list.
export const STANDARD_CHECKLIST = [
  ['irs_determination',   'all',        '501(c)(3) IRS determination letter', 'IRS letter confirming tax-exempt status (nonprofits). Skip if you are a for-profit business.'],
  ['ein_letter',          'all',        'IRS EIN Confirmation Letter (CP 575 or 147C)', 'The IRS letter assigning your Employer Identification Number.'],
  ['articles_of_incorporation', 'all',  'Articles of Incorporation / Operating Agreement', 'Formation documents filed with your state.'],
  ['bylaws',              'all',        'Bylaws', 'Current signed bylaws (nonprofits) or operating agreement terms.'],
  ['good_standing',       'all',        'Certificate of Good Standing', 'From your Secretary of State, dated within the last 12 months.'],
  ['w9',                  'all',        'W-9 Tax Form', 'Signed IRS Form W-9.'],
  ['financial_statements','all',        'Financial Statements (P&L, Balance Sheet)', 'Most recent fiscal year profit & loss and balance sheet.'],
  ['org_budget',          'all',        'Organizational Budget (current year)', 'Annual operating budget for this year.'],
  ['tax_returns',         'all',        'Most Recent Tax Return or Form 990', 'Last filed federal return (Form 990/990-EZ/990-N for nonprofits).'],
  ['insurance_coi',       'all',        'Certificate of Insurance (COI)', 'Current general liability insurance certificate.'],
  ['org_chart',           'all',        'Organizational Chart', 'Leadership and staff structure.'],
  ['key_staff_resumes',   'all',        'Resumes of Key Staff', 'Resumes/CVs for the executive director and program leads.'],
  ['business_license',    'state',      'Business / Professional License', 'State or local license required for your services, if any.'],
  ['board_list',          'foundation', 'Board of Directors List', 'Names, titles and affiliations of board members.'],
  ['letter_of_support_community', 'foundation', 'Letter of Support — Community Partner', 'A signed letter from a partner who knows your work.'],
  ['annual_report',       'foundation', 'Annual Report or Program Overview', 'What you do, who you serve and recent results.'],
  ['sam_registration',    'federal',    'SAM.gov Registration (UEI)', 'Proof of active SAM.gov registration and your UEI.'],
  ['capability_statement','federal',    'Capability Statement', 'One-page summary of services, past performance and certifications.'],
  ['certifications',      'federal',    'Certifications (Veteran-, Minority-, Woman-owned, etc.)', 'Any business certifications you hold. Skip if none.'],
  ['indirect_cost_rate',  'federal',    'Indirect Cost Rate Agreement', 'Negotiated indirect cost rate agreement, if you have one.'],
  ['letter_of_support_government', 'federal', 'Letter of Support — Government / Agency Partner', 'From an agency or public partner, if applicable.'],
];
