import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { applyCreateOnlyPlan } from '../src/p1-sandbox.mjs';

async function temp() { return fs.mkdtemp(path.join(os.tmpdir(), 'aivault-p1-')); }
const plan = (p, content='ok') => ({ ok:true, edits:[{op:'replace_file',path:p,content}] });

test('sandbox creates an agent file inside temp workspace', async t => {
  const root=await temp(); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const r=await applyCreateOnlyPlan({workspaceRoot:root,plan:plan('agent/src/generated.mjs','export const ok=true;')});
  assert.deepEqual(r.written,['agent/src/generated.mjs']);
  assert.equal(await fs.readFile(path.join(root,'agent/src/generated.mjs'),'utf8'),'export const ok=true;');
});

test('sandbox is create-only and refuses overwrite', async t => {
  const root=await temp(); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'agent/src'),{recursive:true}); await fs.writeFile(path.join(root,'agent/src/existing.mjs'),'old');
  await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:plan('agent/src/existing.mjs','new')}),/SANDBOX_TARGET_EXISTS/);
  assert.equal(await fs.readFile(path.join(root,'agent/src/existing.mjs'),'utf8'),'old');
});

test('sandbox rejects traversal outside workspace', async t => {
  const root=await temp(); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:plan('agent/src/../../../escape.mjs')}),/(PATH_DENIED|SANDBOX_ESCAPE)/);
});

test('sandbox rejects NUL, drive and UNC paths', async t => {
  const root=await temp(); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for (const p of ['agent/src/x\0.mjs','C:\\agent\\src\\x.mjs','\\\\server\\share\\x.mjs']) await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:plan(p)}),/SANDBOX_PATH_DENIED/);
});

test('sandbox rejects symlink parent', async t => {
  const root=await temp(); const outside=await temp(); t.after(()=>Promise.all([fs.rm(root,{recursive:true,force:true}),fs.rm(outside,{recursive:true,force:true})]));
  await fs.mkdir(path.join(root,'agent'),{recursive:true}); await fs.symlink(outside,path.join(root,'agent/src'));
  await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:plan('agent/src/escape.mjs')}),/SANDBOX_SYMLINK_DENIED/);
});

test('sandbox rejects symlink target', async t => {
  const root=await temp(); const outside=await temp(); t.after(()=>Promise.all([fs.rm(root,{recursive:true,force:true}),fs.rm(outside,{recursive:true,force:true})]));
  await fs.mkdir(path.join(root,'agent/src'),{recursive:true}); const out=path.join(outside,'outside.mjs'); await fs.writeFile(out,'outside'); await fs.symlink(out,path.join(root,'agent/src/link.mjs'));
  await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:plan('agent/src/link.mjs')}),/SANDBOX_SYMLINK_DENIED/);
  assert.equal(await fs.readFile(out,'utf8'),'outside');
});

test('sandbox preflight rejects duplicate targets before writing', async t => {
  const root=await temp(); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const p={ok:true,edits:[{op:'replace_file',path:'agent/src/a.mjs',content:'a'},{op:'replace_file',path:'agent/src/a.mjs',content:'b'}]};
  await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:p}),/SANDBOX_DUPLICATE_TARGET/);
  await assert.rejects(()=>fs.access(path.join(root,'agent/src/a.mjs')));
});

test('sandbox enforces UTF-8 byte limit before writing', async t => {
  const root=await temp(); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:plan('agent/src/large.mjs','界'.repeat(20000))}),/SANDBOX_CONTENT_TOO_LARGE/);
  await assert.rejects(()=>fs.access(path.join(root,'agent/src/large.mjs')));
});

test('multi-file preflight failure leaves no partial file', async t => {
  const root=await temp(); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'agent/src'),{recursive:true}); await fs.writeFile(path.join(root,'agent/src/existing.mjs'),'old');
  const p={ok:true,edits:[{op:'replace_file',path:'agent/src/new.mjs',content:'new'},{op:'replace_file',path:'agent/src/existing.mjs',content:'bad'}]};
  await assert.rejects(()=>applyCreateOnlyPlan({workspaceRoot:root,plan:p}),/SANDBOX_TARGET_EXISTS/);
  await assert.rejects(()=>fs.access(path.join(root,'agent/src/new.mjs')));
  assert.equal(await fs.readFile(path.join(root,'agent/src/existing.mjs'),'utf8'),'old');
});
