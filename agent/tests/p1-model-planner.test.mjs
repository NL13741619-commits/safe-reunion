import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelAdapter, mockZeroCostTransport } from '../src/p1-model-adapter.mjs';
import { parseEditPlan, summarizePlan } from '../src/p1-planner.mjs';

const env = { AIVAULT_KILL_SWITCH:'0', AIVAULT_ALLOW_PAID:'0', AIVAULT_MODEL_PROVIDER:'mock', AIVAULT_MODEL_NAME:'contract-test', AIVAULT_MOCK_CONTRACT:'1' };
const task = { task_id:'P1-test' };
const marked = fn => { fn.aivaultMockTransport = true; return fn; };

test('adapter is fail-closed while kill switch is unset', async () => { const r=await new ModelAdapter({env:{},transport:mockZeroCostTransport()}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_KILL_SWITCH'); assert.equal(r.called,false); });
test('adapter requires explicit zero-paid policy', async () => { const r=await new ModelAdapter({env:{AIVAULT_KILL_SWITCH:'0'},transport:mockZeroCostTransport()}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_PAID_POLICY_UNSET'); });
test('adapter is BLOCKED_NO_MODEL after safety enables without model', async () => { const r=await new ModelAdapter({env:{AIVAULT_KILL_SWITCH:'0',AIVAULT_ALLOW_PAID:'0'},transport:mockZeroCostTransport()}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_NO_MODEL'); });
test('mock provider requires explicit test-only switch', async () => { const r=await new ModelAdapter({env:{AIVAULT_KILL_SWITCH:'0',AIVAULT_ALLOW_PAID:'0',AIVAULT_MODEL_PROVIDER:'mock',AIVAULT_MODEL_NAME:'x'},transport:mockZeroCostTransport()}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_MOCK_NOT_ENABLED'); });
test('unknown real provider is blocked even with token', async () => { const r=await new ModelAdapter({env:{AIVAULT_KILL_SWITCH:'0',AIVAULT_ALLOW_PAID:'0',AIVAULT_MODEL_PROVIDER:'unknown',AIVAULT_MODEL_NAME:'x',AIVAULT_MODEL_TOKEN:'secret'},transport:mockZeroCostTransport()}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_UNVERIFIED_PROVIDER'); assert.equal(r.called,false); });
test('adapter blocks when transport is absent', async () => { const r=await new ModelAdapter({env}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_NO_TRANSPORT'); });
test('mock mode rejects arbitrary transport function', async () => { const r=await new ModelAdapter({env,transport:async()=>({output:'x',cost_usd:0})}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_UNTRUSTED_MOCK_TRANSPORT'); assert.equal(r.called,false); });
test('mock zero-cost model contract succeeds', async () => { const r=await new ModelAdapter({env,transport:mockZeroCostTransport('{"edits":[]}')}).generate({task,instruction:'x'}); assert.equal(r.ok,true); assert.equal(r.cost_usd,0); });
test('nonzero model cost is rejected', async () => { const r=await new ModelAdapter({env,transport:marked(async()=>({output:'x',cost_usd:0.01}))}).generate({task,instruction:'x'}); assert.equal(r.code,'MODEL_NONZERO_COST'); });
test('bad model response is rejected', async () => { const r=await new ModelAdapter({env,transport:marked(async()=>({}))}).generate({task,instruction:'x'}); assert.equal(r.code,'MODEL_BAD_RESPONSE'); });
test('planner accepts one source edit with deterministic non-shell test command', () => { const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'agent/src/example.mjs',content:'export const x=1;'}]})); assert.equal(p.ok,true); assert.deepEqual(p.test_command,{file:'node',args:['--test','agent/tests'],shell:false}); const s=summarizePlan(p); assert.equal(s.status,'READY_FOR_SANDBOX'); assert.equal(s.mutation_scope,'agent/src + agent/tests'); });
test('planner rejects root product mutation', () => { const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'index.html',content:'x'}]})); assert.equal(p.ok,false); });
test('planner rejects workflow mutation', () => { const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'.github/workflows/x.yml',content:'x'}]})); assert.equal(p.ok,false); });
test('planner rejects traversal', () => { const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'agent/src/../../index.html',content:'x'}]})); assert.equal(p.ok,false); });
test('planner rejects arbitrary operation', () => { const p=parseEditPlan(JSON.stringify({edits:[{op:'shell',path:'agent/src/x',content:'rm -rf /'}]})); assert.equal(p.ok,false); });
test('planner rejects duplicate edit targets', () => { const edits=[{op:'replace_file',path:'agent/src/x.mjs',content:'a'},{op:'replace_file',path:'agent/src/x.mjs',content:'b'}]; assert.equal(parseEditPlan(JSON.stringify({edits})).code,'DUPLICATE_EDIT_TARGET'); });
test('planner rejects more than eight edits', () => { const edits=Array.from({length:9},(_,i)=>({op:'replace_file',path:`agent/src/x${i}.mjs`,content:'x'})); assert.equal(parseEditPlan(JSON.stringify({edits})).ok,false); });
test('planner rejects oversized ASCII content', () => { const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'agent/src/x.mjs',content:'x'.repeat(50001)}]})); assert.equal(p.code,'CONTENT_TOO_LARGE'); });
test('planner enforces limit in UTF-8 bytes, not JS characters', () => { const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'agent/src/x.mjs',content:'界'.repeat(20000)}]})); assert.equal(p.code,'CONTENT_TOO_LARGE'); });
