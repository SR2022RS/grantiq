import * as p from '../../tools/playwright/index.js';
import { recordNoteSchema, makeRecordNote } from '../../tools/shared/index.js';

const recordNote = makeRecordNote('playwright');

const TOOL_FUNCTIONS = {
  start_session: p.startSession,
  save_progress: p.saveProgress,
  end_session: p.endSession,
  navigate: p.navigate,
  screenshot: p.screenshot,
  snapshot_page: p.snapshotPage,
  fill_field: p.fillField,
  click: p.click,
  select_option: p.selectOption,
  check_field: p.checkField,
  upload_file: p.uploadFile,
  gate_for_human: p.gateForHuman,
  submit_form: p.submitForm,
  record_note: recordNote,
};

export const PLAYWRIGHT_TOOL_SCHEMAS = [
  p.startSessionSchema,
  p.saveProgressSchema,
  p.endSessionSchema,
  p.navigateSchema,
  p.screenshotSchema,
  p.snapshotPageSchema,
  p.fillFieldSchema,
  p.clickSchema,
  p.selectOptionSchema,
  p.checkFieldSchema,
  p.uploadFileSchema,
  p.gateForHumanSchema,
  p.submitFormSchema,
  recordNoteSchema,
];

export async function dispatch(name, input) {
  const fn = TOOL_FUNCTIONS[name];
  if (!fn) throw new Error(`Unknown Playwright tool: ${name}`);
  return fn(input);
}
