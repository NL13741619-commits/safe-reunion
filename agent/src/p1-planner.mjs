import { assertWorkspacePath } from './p1-runner.mjs';

export function parseEditPlan(text) {
  let value;
  try { value = JSON.parse(String(text)); } catch { return { ok: false, code: 'INVALID_MODEL_PLAN' }; }
  if (!value || !Array.isArray(value.edits) || value.edits.length < 1 || value.edits.length > 8) return { ok: false, code: 'INVALID_MODEL_PLAN' };
  const edits = [];
  const seen = new Set();
  try {
    for (const edit of value.edits) {
      if (!edit || edit.op !== 'replace_file') throw new Error('OP_DENIED');
      const path = assertWorkspacePath(edit.path);
      if (seen.has(path)) throw new Error('DUPLICATE_EDIT_TARGET');
      seen.add(path);
      const content = String(edit.content ?? '');
      if (Buffer.byteLength(content, 'utf8') > 50_000) throw new Error('CONTENT_TOO_LARGE');
      edits.push({ op: 'replace_file', path, content });
    }
  } catch (error) { return { ok: false, code: error.message || 'PLAN_DENIED' }; }
  return { ok: true, edits, test_command: { file: 'node', args: ['--test', 'agent/tests'], shell: false }, draft_pr_only: true, direct_main_push: false, auto_merge: false };
}

export function summarizePlan(plan) {
  if (!plan?.ok) return { status: 'BLOCKED', reason: plan?.code || 'INVALID_PLAN' };
  return { status: 'READY_FOR_SANDBOX', files: plan.edits.map(e => e.path), test_command: plan.test_command, mutation_scope: 'agent/src + agent/tests', draft_pr_only: true };
}
