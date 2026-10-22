import path from 'node:path';

const FORBIDDEN = ['.github/workflows', '.git', '.env', 'secrets'];

export function normalizeRepoPath(input) {
  if (typeof input !== 'string' || !input.trim() || input.startsWith('/')) throw new Error('INVALID_PATH');
  const normalized = path.posix.normalize(input);
  if (normalized === '..' || normalized.startsWith('../')) throw new Error('PATH_TRAVERSAL');
  return normalized.replace(/^\.\//, '');
}

export function validateTask(task, policy) {
  const errors = [];
  if (!task || typeof task !== 'object') return { ok: false, errors: ['INVALID_TASK'] };
  if (!/^AIVAULT-[A-Z0-9][A-Z0-9._-]{1,63}$/.test(task.task_id || '')) errors.push('INVALID_TASK_ID');
  if (task.repo !== policy.repo) errors.push('REPO_NOT_ALLOWED');
  if (!policy.issuerIds.includes(task.issuer?.github_user_id)) errors.push('ISSUER_NOT_ALLOWED');
  if (task.approval?.mode !== 'dry-run') errors.push('EXECUTION_NOT_APPROVED');
  if (task.approval?.approved_by_owner !== true) errors.push('OWNER_APPROVAL_REQUIRED');
  if (task.max_cost?.paid_api_allowed !== false || Number(task.max_cost?.amount) !== 0) errors.push('PAID_API_NOT_ALLOWED');
  if (!Array.isArray(task.allowed_paths) || task.allowed_paths.length === 0) errors.push('ALLOWED_PATHS_REQUIRED');
  for (const raw of task.allowed_paths || []) {
    try {
      const p = normalizeRepoPath(raw);
      if (FORBIDDEN.some(x => p === x || p.startsWith(`${x}/`) || p.includes(`/${x}/`))) errors.push(`FORBIDDEN_PATH:${p}`);
    } catch (e) { errors.push(e.message); }
  }
  if (!Array.isArray(task.acceptance_tests) || task.acceptance_tests.length === 0) errors.push('ACCEPTANCE_TESTS_REQUIRED');
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function planDryRun(task) {
  return {
    task_id: task.task_id,
    status: 'done',
    mode: 'dry-run',
    mutation_performed: false,
    paid_api_called: false,
    plan: [
      'verify trusted GitHub delivery and immutable issuer identity',
      'validate task contract and policy',
      'prepare isolated workspace',
      'request coding-model plan only when an authorized model is configured',
      'run fixed allowlisted acceptance tests',
      'execution-mode branch/PR mutation remains blocked'
    ]
  };
}
