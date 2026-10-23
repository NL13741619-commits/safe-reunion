const STATES = new Set(['QUEUED','CLAIMED','RUNNING','TESTING','PR_OPEN','BLOCKED','FAILED','DEAD_LETTER','DONE']);
const MAX_ATTEMPTS = 3;

function validFeatureBranch(branch) {
  return typeof branch === 'string' && /^feature\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(branch) && !branch.includes('..') && !branch.includes('//') && !branch.endsWith('/') && !branch.endsWith('.') && !branch.endsWith('.lock') && !branch.includes('@{');
}

export function createTask(input) {
  const taskId = String(input?.task_id || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(taskId) || !validFeatureBranch(input?.base_branch)) throw new Error('INVALID_TASK');
  return { task_id: taskId, base_branch: input.base_branch, state: 'QUEUED', lease: null, attempts: 0, audit: [] };
}

export function transition(task, next, detail = '') {
  if (!STATES.has(next)) throw new Error('INVALID_STATE');
  const allowed = {
    QUEUED: ['CLAIMED','BLOCKED','DEAD_LETTER'], CLAIMED: ['RUNNING','QUEUED','BLOCKED'], RUNNING: ['TESTING','QUEUED','BLOCKED','FAILED'],
    TESTING: ['PR_OPEN','QUEUED','FAILED','BLOCKED'], PR_OPEN: ['DONE','FAILED'], BLOCKED: [], FAILED: ['QUEUED','BLOCKED','DEAD_LETTER'], DEAD_LETTER: [], DONE: []
  };
  if (!allowed[task.state]?.includes(next)) throw new Error('INVALID_TRANSITION');
  task.audit.push({ from: task.state, to: next, detail: String(detail).slice(0,200) });
  task.state = next;
  return task;
}

export function claim(task, workerId, now = Date.now(), ttlMs = 60_000) {
  if (task.state !== 'QUEUED') throw new Error('NOT_QUEUED');
  if (task.attempts >= MAX_ATTEMPTS) { transition(task, 'DEAD_LETTER', 'retry limit reached'); throw new Error('MAX_ATTEMPTS_EXCEEDED'); }
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

export function transitionOwned(task, next, workerId, now = Date.now(), detail = '') {
  assertLeaseOwner(task, workerId, now);
  return transition(task, next, detail);
}

export function heartbeat(task, workerId, now = Date.now(), ttlMs = 60_000) {
  assertLeaseOwner(task, workerId, now);
  if (!Number.isFinite(ttlMs) || ttlMs < 1000 || ttlMs > 300000) throw new Error('INVALID_LEASE');
  task.lease.expires_at = now + ttlMs;
  task.audit.push({ from: task.state, to: task.state, detail: 'heartbeat' });
  return task.lease.expires_at;
}

export function recoverExpiredLease(task, now = Date.now()) {
  if (['CLAIMED','RUNNING','TESTING'].includes(task.state) && task.lease && task.lease.expires_at <= now) {
    task.lease = null;
    transition(task, 'QUEUED', 'expired lease recovered');
    return true;
  }
  return false;
}

export function assertWorkspacePath(path) {
  const value = String(path || '').replaceAll('\\','/');
  const segments = value.split('/');
  if (!value || value.startsWith('/') || value.includes('\0') || value.includes('//') || segments.includes('.') || segments.includes('..') || value.startsWith('.git/') || value.startsWith('.github/workflows/')) throw new Error('PATH_DENIED');
  if (!(value.startsWith('agent/src/') || value.startsWith('agent/tests/'))) throw new Error('PATH_OUTSIDE_WORKSPACE');
  return value;
}

export function modelGate(env = process.env) {
  if (env.AIVAULT_KILL_SWITCH !== '0') return { ok: false, code: 'BLOCKED_KILL_SWITCH' };
  if (env.AIVAULT_ALLOW_PAID === '1') return { ok: false, code: 'BLOCKED_PAID_MODEL' };
  if (env.AIVAULT_ALLOW_PAID !== '0') return { ok: false, code: 'BLOCKED_PAID_POLICY_UNSET' };
  if (!env.AIVAULT_MODEL_PROVIDER || !env.AIVAULT_MODEL_NAME) return { ok: false, code: 'BLOCKED_NO_MODEL' };
  if (env.AIVAULT_MODEL_PROVIDER === 'mock') {
    if (env.AIVAULT_MOCK_CONTRACT !== '1') return { ok: false, code: 'BLOCKED_MOCK_NOT_ENABLED' };
    return { ok: true, provider: 'mock', model: env.AIVAULT_MODEL_NAME, mock: true };
  }
  return { ok: false, code: 'BLOCKED_UNVERIFIED_PROVIDER' };
}

export function buildModelRequest(task, instruction, env = process.env) {
  const gate = modelGate(env);
  if (!gate.ok) return gate;
  return { ok: true, provider: gate.provider, model: gate.model, task_id: task.task_id, instruction: String(instruction).slice(0,4000), mutation_scope: 'agent/src + agent/tests', direct_main_push: false, auto_merge: false, mock: gate.mock === true };
}
