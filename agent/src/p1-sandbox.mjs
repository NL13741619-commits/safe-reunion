import fs from 'node:fs/promises';
import path from 'node:path';
import { assertWorkspacePath } from './p1-runner.mjs';

function inside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}

function rejectRawPath(raw) {
  const value = String(raw ?? '');
  if (!value || value.includes('\0') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\') || value.startsWith('//')) throw new Error('SANDBOX_PATH_DENIED');
  return value;
}

async function assertNoSymlinkChain(rootReal, target) {
  const rel = path.relative(rootReal, target);
  if (!inside(rootReal, target)) throw new Error('SANDBOX_ESCAPE');
  let current = rootReal;
  const parts = rel.split(path.sep).filter(Boolean);
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = path.join(current, parts[i]);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('SANDBOX_SYMLINK_DENIED');
      if (!stat.isDirectory()) throw new Error('SANDBOX_PARENT_NOT_DIRECTORY');
      const real = await fs.realpath(current);
      if (!inside(rootReal, real)) throw new Error('SANDBOX_ESCAPE');
    } catch (error) {
      if (error?.code === 'ENOENT') await fs.mkdir(current, { recursive: false, mode: 0o700 });
      else throw error;
    }
  }
  try {
    const targetStat = await fs.lstat(target);
    if (targetStat.isSymbolicLink()) throw new Error('SANDBOX_SYMLINK_DENIED');
    throw new Error('SANDBOX_TARGET_EXISTS');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export async function applyCreateOnlyPlan({ workspaceRoot, plan }) {
  if (!plan?.ok || !Array.isArray(plan.edits)) throw new Error('SANDBOX_INVALID_PLAN');
  const rootReal = await fs.realpath(workspaceRoot);
  const written = [];
  for (const edit of plan.edits) {
    if (edit?.op !== 'replace_file') throw new Error('SANDBOX_OP_DENIED');
    const safe = assertWorkspacePath(rejectRawPath(edit.path));
    const target = path.resolve(rootReal, ...safe.split('/'));
    if (!inside(rootReal, target)) throw new Error('SANDBOX_ESCAPE');
    await assertNoSymlinkChain(rootReal, target);
    const handle = await fs.open(target, 'wx', 0o600);
    try { await handle.writeFile(String(edit.content ?? ''), 'utf8'); }
    finally { await handle.close(); }
    const finalReal = await fs.realpath(target);
    if (!inside(rootReal, finalReal)) throw new Error('SANDBOX_ESCAPE');
    written.push(safe);
  }
  return { ok: true, mode: 'create-only', written, production_mutation: false };
}
