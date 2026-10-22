import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelAdapter, mockZeroCostTransport } from '../src/p1-model-adapter.mjs';
import { parseEditPlan, summarizePlan } from '../src/p1-planner.mjs';

const env = { AIVAULT_MODEL_PROVIDER:'mock', AIVAULT_MODEL_NAME:'contract-test', AIVAULT_MOCK_CONTRACT:'1' };
const task = { task_id:'P1-test' };

test('adapter is BLOCKED_NO_MODEL without configuration', async () => {
  const r = await new ModelAdapter({env:{},transport:mockZeroCostTransport()}).generate({task,instruction:'x'});
  assert.equal(r.code,'BLOCKED_NO_MODEL'); assert.equal(r.called,false);
});
test('mock provider requires explicit test-only switch', async () => {
  const r = await new ModelAdapter({env:{AIVAULT_MODEL_PROVIDER:'mock',AIVAULT_MODEL_NAME:'x'},transport:mockZeroCostTransport()}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_MOCK_NOT_ENABLED');
});
test('unknown real provider is blocked even with token', async () => {
  const r = await new ModelAdapter({env:{AIVAULT_MODEL_PROVIDER:'unknown',AIVAULT_MODEL_NAME:'x',AIVAULT_MODEL_TOKEN:'secret'},transport:mockZeroCostTransport()}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_PROVIDER_NOT_AUTHORIZED');
});
test('adapter blocks when transport is absent', async () => {
  const r = await new ModelAdapter({env}).generate({task,instruction:'x'}); assert.equal(r.code,'BLOCKED_NO_TRANSPORT');
});
test('mock zero-cost model contract succeeds', async () => {
  const r = await new ModelAdapter({env,transport:mockZeroCostTransport('{"edits":[]}')}).generate({task,instruction:'x'});
  assert.equal(r.ok,true); assert.equal(r.cost_usd,0);
});
test('nonzero model cost is rejected', async () => {
  const transport=async()=>({output:'x',cost_usd:0.01}); const r=await new ModelAdapter({env,transport}).generate({task,instruction:'x'}); assert.equal(r.code,'MODEL_NONZERO_COST');
});
test('bad model response is rejected', async () => {
  const r=await new ModelAdapter({env,transport:async()=>({})}).generate({task,instruction:'x'}); assert.equal(r.code,'MODEL_BAD_RESPONSE');
});
test('planner accepts one agent replace_file edit', () => {
  const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'agent/src/example.mjs',content:'export const x=1;'}]})); assert.equal(p.ok,true); assert.equal(summarizePlan(p).status,'READY_FOR_SANDBOX');
});
test('planner rejects root product mutation', () => {
  const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'index.html',content:'x'}]})); assert.equal(p.ok,false);
});
test('planner rejects workflow mutation', () => {
  const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'.github/workflows/x.yml',content:'x'}]})); assert.equal(p.ok,false);
});
test('planner rejects traversal', () => {
  const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'agent/../index.html',content:'x'}]})); assert.equal(p.ok,false);
});
test('planner rejects arbitrary operation', () => {
  const p=parseEditPlan(JSON.stringify({edits:[{op:'shell',path:'agent/x',content:'rm -rf /'}]})); assert.equal(p.ok,false);
});
test('planner rejects more than eight edits', () => {
  const edits=Array.from({length:9},(_,i)=>({op:'replace_file',path:`agent/x${i}`,content:'x'})); assert.equal(parseEditPlan(JSON.stringify({edits})).ok,false);
});
test('planner rejects oversized content', () => {
  const p=parseEditPlan(JSON.stringify({edits:[{op:'replace_file',path:'agent/x',content:'x'.repeat(50001)}]})); assert.equal(p.ok,false);
});
