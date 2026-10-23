import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createTask, claim, recoverExpiredLease, transitionOwned } from './p1-runner.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

// Local durable volume only: every worker must share this directory.
// A crash-held lock fails closed; never automatically steal a lock from a live worker.
export class TaskStore {
  constructor(root) { this.root = path.resolve(root); }
  async transact(input, change) {
    const fresh = createTask(input);
    const fingerprint = createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    const file = path.join(this.root, fresh.task_id + '.json');
    const lock = file + '.lock';
    try { await fs.mkdir(lock, { mode: 0o700 }); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('STORE_BUSY'); throw error; }
    let temp;
    try {
      let record;
      try { record = JSON.parse(await fs.readFile(file, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw new Error('STORE_CORRUPT'); }
      if (record) {
        if (record.version !== 1 || !record.task || record.task.task_id !== fresh.task_id) throw new Error('STORE_CORRUPT');
        if (record.fingerprint !== fingerprint) throw new Error('TASK_ID_CONFLICT');
      } else record = { version: 1, fingerprint, revision: 0, task: fresh };
      const result = await change(record.task);
      record.revision += 1;
      temp = file + '.' + randomUUID() + '.tmp';
      const handle = await fs.open(temp, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(record) + '\n'); await handle.sync(); }
      finally { await handle.close(); }
      await fs.rename(temp, file);
      temp = undefined;
      const dir = await fs.open(this.root, 'r');
      try { await dir.sync(); } finally { await dir.close(); }
      return { record, result };
    } finally {
      if (temp) await fs.rm(temp, { force: true });
      await fs.rmdir(lock);
    }
  }
  async enqueue(input) { return this.transact(input, task => ({ task_id: task.task_id })); }
  async claim(input, worker, now = Date.now(), ttl = 60000) {
    const saved = await this.transact(input, task => {
      recoverExpiredLease(task, now);
      // Persist dead-letter even when the claim API throws at the retry limit.
      try { claim(task, worker, now, ttl); return { ok: true }; }
      catch (error) {
        if (error.message === 'MAX_ATTEMPTS_EXCEEDED') return { ok: false, code: error.message };
        throw error;
      }
    });
    if (!saved.result.ok) throw new Error(saved.result.code);
    return saved.record.task;
  }
  async transition(input, worker, next, now = Date.now(), detail = '') {
    return this.transact(input, task => transitionOwned(task, next, worker, now, detail).state);
  }
}

