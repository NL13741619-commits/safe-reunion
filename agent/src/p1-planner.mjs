import { assertWorkspacePath } from './p1-runner.mjs';

export function parseEditPlan(text) {
  let value;
  try { value = JSON.parse(String(text)); } catch { return { ok: false, code: 'INVALID_MODEL_PLAN' }; }
  if (!value || !Array.isArray(value.edits) || value.edits.length < 1 || value.edits.length > 8) return { ok: false, code: 'INVALID_MODEL_PLAN' };
  const edits = [];
  try {
    for (const edit of value.edits) {
      if (!edit || edit.op !== 'replace_file') throw new Error('OP_DENIED');
      const path = assertWorkspacePath(edit.path);
      const content = String(edit.content ?? '');
      if (content.length > 50_000) throw new Error('CONTENT_TOO_LARGE');
      edits.push({ op: 'replace_file', path, content });
    }
  } catch (error) { return { ok: false, code: error.message || 'PLAN_DENIED' }; }
  return { ok: true, edits, tests: ['node --test tests/*.test.mjs'], draft_pr_only: true, direct_main_push: false, auto_merge: false };
}

export function summarizePlan(plan) {
  if (!plan?.ok) return { status: 'BLOCKED', reason: plan?.code || 'INVALID_PLAN' };
  return { status: 'READY_FOR_SANDBOX', files: plan.edits.map(e => e.path), tests: plan.tests, mutation_scope: 'agent/', draft_pr_only: true };
}
