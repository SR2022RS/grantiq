// Maps tool name → implementation function. Used by the Anthropic tool-use loop.

import * as g from '../../tools/grants/index.js';
import {
  recordNoteSchema,
  alertUserSchema,
  makeRecordNote,
  makeAlertUser,
} from '../../tools/shared/index.js';

const recordNote = makeRecordNote('grants');
const alertUser = makeAlertUser('grants');

const TOOL_FUNCTIONS = {
  web_search: g.webSearch,
  fetch_webpage: g.fetchWebpage,
  query_pipeline: g.queryPipeline,
  save_grant: g.saveGrant,
  score_grant: g.scoreGrant,
  check_documents: g.checkDocuments,
  list_deadlines: g.listDeadlines,
  draft_narrative: g.draftNarrative,
  generate_budget: g.generateBudget,
  save_draft: g.saveDraft,
  search_past_drafts: g.searchPastDrafts,
  get_grant: g.getGrant,
  get_org: g.getOrg,
  get_document_vault: g.getDocumentVault,
  read_document: g.readDocument,
  get_draft: g.getDraft,
  delegate_to_playwright: g.delegateToPlaywright,
  generate_document: g.generateDocument,
  record_note: recordNote,
  alert_user: alertUser,
};

export const GRANTS_TOOL_SCHEMAS = [
  g.webSearchSchema,
  g.fetchWebpageSchema,
  g.queryPipelineSchema,
  g.saveGrantSchema,
  g.scoreGrantSchema,
  g.checkDocumentsSchema,
  g.listDeadlinesSchema,
  g.draftNarrativeSchema,
  g.generateBudgetSchema,
  g.saveDraftSchema,
  g.searchPastDraftsSchema,
  g.getGrantSchema,
  g.getOrgSchema,
  g.getDocumentVaultSchema,
  g.readDocumentSchema,
  g.getDraftSchema,
  g.delegateToPlaywrightSchema,
  g.generateDocumentSchema,
  recordNoteSchema,
  alertUserSchema,
];

export async function dispatch(name, input) {
  const fn = TOOL_FUNCTIONS[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(input);
}
