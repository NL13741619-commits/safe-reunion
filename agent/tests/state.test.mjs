import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskState } from '../src/state.mjs';
test('dry-run state reaches done through accepted/running',()=>{const s=new TaskState('x');s.transition('accepted').transition('running').transition('done');assert.equal(s.status,'done');});
test('cannot jump from queued to done/pr_open',()=>{const s=new TaskState('x');assert.throws(()=>s.transition('done'));assert.throws(()=>s.transition('pr_open'));});
