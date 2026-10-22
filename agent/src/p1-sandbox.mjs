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

async function inspectParentChain(rootReal, target) {
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
      if (error?.code !== 'ENOENT') throw error;
      break;
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

async function ensureParents(rootReal, target) {
  const parent = path.dirname(target);
  await fs.mkdir(parent, { recursive: true, mode: 0o700 });
  const parentReal = await fs.realpath(parent);
  if (!inside(rootReal, parentReal)) throw new Error('SANDBOX_ESCAPE');
  let current = rootReal;
  for (const part of path.relative(rootReal, parentReal).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('SANDBOX_SYMLINK_DENIED');
  }
}

function preflightPlan(plan) {
  if (!plan?.ok || !Array.isArray(plan.edits) || plan.edits.length < 1 || plan.edits.length > 8) throw new Error('SANDBOX_INVALID_PLAN');
  const seen = new Set();
  return plan.edits.map(edit => {
    if (edit?.op !== 'replace_file') throw new Error('SANDBOX_OP_DENIED');
    const safe = assertWorkspacePath(rejectRawPath(edit.path));
    if (seen.has(safe)) throw new Error('SANDBOX_DUPLICATE_TARGET');
    seen.add(safe);
    const content = String(edit.content ?? '');
    if (Buffer.byteLength(content, 'utf8') > 50_000) throw new Error('SANDBOX_CONTENT_TOO_LARGE');
    return { safe, content };
  });
}

export async function applyCreateOnlyPlan({ workspaceRoot, plan }) {
  const edits = preflightPlan(plan);
  const rootReal = await fs.realpath(workspaceRoot);
  const prepared = [];
  for (const edit of edits) {
    const target = path.resolve(rootReal, ...edit.safe.split('/'));
    if (!inside(rootReal, target)) throw new Error('SANDBOX_ESCAPE');
    await inspectParentChain(rootReal, target);
    prepared.push({ ...edit, target });
  }

  const created = [];
  try {
    for (const edit of prepared) {
      await ensureParents(rootReal, edit.target);
      await inspectParentChain(rootReal, edit.target);
      const handle = await fs.open(edit.target, 'wx', 0o600);
      try { await handle.writeFile(edit.content, 'utf8'); }
      finally { await handle.close(); }
      created.push(edit.target);
      const finalReal = await fs.realpath(edit.target);
      if (!inside(rootReal, finalReal)) throw new Error('SANDBOX_ESCAPE');
    }
  } catch (error) {
    await Promise.allSettled(created.map(file => fs.rm(file, { force: true })));
    throw error;
  }
  return { ok: true, mode: 'create-only', written: prepared.map(e => e.safe), production_mutation: false };
}
