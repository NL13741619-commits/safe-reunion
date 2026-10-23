import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TaskStore } from '../src/p1-task-store.mjs';
import { runP1MockE2E } from '../src/p1-orchestrator.mjs';

const input = { task_id: 'durable-test', base_branch: 'feature/p1' };
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'aivault-store-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
test('restart preserves task lease, state and audit', async t => {
  const root = await fixture(t);
  await new TaskStore(root).claim(input, 'worker-a', 0, 1000);
  await new TaskStore(root).transition(input, 'worker-a', 'RUNNING', 1, 'started');
  const { record } = await new TaskStore(root).enqueue(input);
  assert.equal(record.task.state, 'RUNNING');
  assert.equal(record.task.lease.worker_id, 'worker-a');
  assert.equal(record.task.audit.at(-1).detail, 'started');
  await assert.rejects(new TaskStore(root).claim(input, 'worker-b', 2, 1000), /NOT_QUEUED/);
});
test('concurrent stores allow only one claim', async t => {
  const root = await fixture(t);
  const results = await Promise.allSettled([
    new TaskStore(root).claim(input, 'a', 0, 1000),
    new TaskStore(root).claim(input, 'b', 0, 1000)
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});
test('same id with conflicting branch is rejected without replacing task', async t => {
  const root = await fixture(t), store = new TaskStore(root);
  await store.enqueue(input);
  await assert.rejects(store.enqueue({ ...input, base_branch: 'feature/other' }), /TASK_ID_CONFLICT/);
  assert.equal((await store.enqueue(input)).record.task.base_branch, 'feature/p1');
});
test('fingerprint covers instruction and paths while ignoring object key order', async t => {
  const root = await fixture(t), store = new TaskStore(root);
  const command = { ...input, instruction: 'safe task', allowed_paths: ['agent/src/a.mjs'] };
  await store.enqueue(command);
  await store.enqueue({ allowed_paths: command.allowed_paths, instruction: command.instruction, base_branch: input.base_branch, task_id: input.task_id });
  await assert.rejects(store.enqueue({ ...command, instruction: 'different task' }), /TASK_ID_CONFLICT/);
  await assert.rejects(store.enqueue({ ...command, allowed_paths: ['agent/src/b.mjs'] }), /TASK_ID_CONFLICT/);
});
test('expired lease recovers across store restart; old worker cannot transition', async t => {
  const root = await fixture(t);
  await new TaskStore(root).claim(input, 'a', 0, 1000);
  const task = await new TaskStore(root).claim(input, 'b', 1001, 1000);
  assert.equal(task.attempts, 2);
  await assert.rejects(new TaskStore(root).transition(input, 'a', 'RUNNING', 1002), /LEASE_NOT_OWNED/);
  await new TaskStore(root).transition(input, 'b', 'RUNNING', 1002);
});
test('retry exhaustion is durably dead-lettered', async t => {
  const root = await fixture(t), store = new TaskStore(root);
  for (let i = 0; i < 3; i++) await store.claim(input, 'a', i * 2000, 1000);
  await assert.rejects(store.claim(input, 'a', 6000, 1000), /MAX_ATTEMPTS_EXCEEDED/);
  assert.equal((await new TaskStore(root).enqueue(input)).record.task.state, 'DEAD_LETTER');
});
test('corrupt store fails closed and preserves evidence', async t => {
  const root = await fixture(t), file = path.join(root, input.task_id + '.json');
  await fs.writeFile(file, '{bad');
  await assert.rejects(new TaskStore(root).enqueue(input), /STORE_CORRUPT/);
  assert.equal(await fs.readFile(file, 'utf8'), '{bad');
});
test('crash-held lock fails closed without stealing ownership', async t => {
  const root = await fixture(t), lock = path.join(root, input.task_id + '.json.lock');
  await fs.mkdir(lock);
  await assert.rejects(new TaskStore(root).claim(input, 'b', 999999, 1000), /STORE_BUSY/);
  assert.equal((await fs.stat(lock)).isDirectory(), true);
});
test('failed transaction leaves durable state intact and releases lock', async t => {
  const root = await fixture(t), store = new TaskStore(root);
  await store.enqueue(input);
  await assert.rejects(store.transact(input, task => { task.state = 'DONE'; throw new Error('interrupted'); }), /interrupted/);
  assert.equal((await new TaskStore(root).enqueue(input)).record.task.state, 'QUEUED');
});
test('orchestrator persists blocked model result and rejects duplicate after restart', async t => {
  const root = await fixture(t);
  const env = { AIVAULT_KILL_SWITCH: '0', AIVAULT_ALLOW_PAID: '0' };
  const args = { input, instruction: 'proposal', env };
  const result = await runP1MockE2E({ ...args, taskStore: new TaskStore(root) });
  assert.equal(result.code, 'BLOCKED_NO_MODEL');
  assert.equal(result.model_called, false);
  const stored = await new TaskStore(root).enqueue({ ...input, instruction: args.instruction });
  assert.equal(stored.record.task.state, 'BLOCKED');
  await assert.rejects(runP1MockE2E({ ...args, taskStore: new TaskStore(root) }), /NOT_QUEUED/);
});

