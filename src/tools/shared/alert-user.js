import { postAlert } from '../../lib/alerts.js';

export const alertUserSchema = {
  name: 'alert_user',
  description: 'Send the user a notification. Use for urgent deadlines, completed drafts, gated form-fill sessions, or anything requiring user action.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      severity: { type: 'string', enum: ['info', 'warning', 'high', 'critical'] },
      link: { type: 'string', description: 'Optional URL to deep-link from the alert' },
    },
    required: ['message', 'severity'],
  },
};

export function makeAlertUser(agentId) {
  return async function alertUser({ message, severity, link }) {
    try {
      const id = await postAlert({ agentId, severity, message, link });
      return { ok: true, alert_id: id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
}
