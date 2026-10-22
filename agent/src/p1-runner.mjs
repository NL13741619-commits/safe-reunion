const STATES = new Set(['QUEUED','CLAIMED','RUNNING','TESTING','PR_OPEN','BLOCKED','FAILED','DONE']);

function validFeatureBranch(branch) {
  return typeof branch === 'string' && /^feature\/[A-Za-z0-9._/-]+$/.test(branch) && !branch.includes('..') && !branch.endsWith('/') && branch !== 'feature/main';
}

export function createTask(input) {
  if (!input?.task_id || !validFeatureBranch(input?.base_branch)) throw new Error('INVALID_TASK');
  return { task_id: input.task_id, base_branch: input.base_branch, state: 'QUEUED', lease: null, attempts: 0, audit: [] };
}

export function transition(task, next, detail = '') {
  if (!STATES.has(next)) throw new Error('INVALID_STATE');
  const allowed = {
    QUEUED: ['CLAIMED','BLOCKED'], CLAIMED: ['RUNNING','QUEUED','BLOCKED'], RUNNING: ['TESTING','BLOCKED','FAILED'],
    TESTING: ['PR_OPEN','FAILED','BLOCKED'], PR_OPEN: ['DONE','FAILED'], BLOCKED: [], FAILED: ['QUEUED'], DONE: []
  };
  if (!allowed[task.state]?.includes(next)) throw new Error('INVALID_TRANSITION');
  task.audit.push({ from: task.state, to: next, detail: String(detail).slice(0,200) });
  task.state = next;
  return task;
}

export function claim(task, workerId, now = Date.now(), ttlMs = 60_000) {
  if (task.state !== 'QUEUED') throw new Error('NOT_QUEUED');
  if (!workerId || !Number.isFinite(ttlMs) || ttlMs < 1000 || ttlMs > 300000) throw new Error('INVALID_LEASE');
  transition(task, 'CLAIMED', 'lease acquired');
  task.lease = { worker_id: String(workerId).slice(0,100), expires_at: now + ttlMs };
  task.attempts += 1;
  return task;
}

export function assertLeaseOwner(task, workerId, now = Date.now()) {
  if (!task?.lease || task.lease.worker_id !== workerId) throw new Error('LEASE_NOT_OWNED');
  if (task.lease.expires_at <= now) throw new Error('LEASE_EXPIRED');
  return true;
}

export function recoverExpiredLease(task, now = Date.now()) {
  if (task.state === 'CLAIMED' && task.lease && task.lease.expires_at <= now) {
    task.lease = null;
    transition(task, 'QUEUED', 'expired lease recovered');
    return true;
  }
  return false;
}

export function assertWorkspacePath(path) {
  const value = String(path || '').replaceAll('\\','/');
  if (!value || value.startsWith('/') || value.includes('..') || value.startsWith('.git/') || value.startsWith('.github/workflows/')) throw new Error('PATH_DENIED');
  if (!value.startsWith('agent/')) throw new Error('PATH_OUTSIDE_WORKSPACE');
  return value;
}

export function modelGate(env = process.env) {
  if (env.AIVAULT_KILL_SWITCH === '1') return { ok: false, code: 'BLOCKED_KILL_SWITCH' };
  if (!env.AIVAULT_MODEL_PROVIDER || !env.AIVAULT_MODEL_NAME || !env.AIVAULT_MODEL_TOKEN) return { ok: false, code: 'BLOCKED_NO_MODEL' };
  if (env.AIVAULT_ALLOW_PAID === '1') return { ok: false, code: 'BLOCKED_PAID_MODEL' };
  return { ok: true, provider: env.AIVAULT_MODEL_PROVIDER, model: env.AIVAULT_MODEL_NAME };
}

export function buildModelRequest(task, instruction) {
  const gate = modelGate();
  if (!gate.ok) return gate;
  return { ok: true, provider: gate.provider, model: gate.model, task_id: task.task_id, instruction: String(instruction).slice(0,4000), mutation_scope: 'agent/', direct_main_push: false, auto_merge: false };
}
