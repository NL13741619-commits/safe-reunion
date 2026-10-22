import test from 'node:test';
import assert from 'node:assert/strict';
import { runP1MockE2E } from '../src/p1-orchestrator.mjs';
import { mockZeroCostTransport } from '../src/p1-model-adapter.mjs';

const input={task_id:'P1-E2E',base_branch:'feature/p1-e2e'};
const env={AIVAULT_KILL_SWITCH:'0',AIVAULT_ALLOW_PAID:'0',AIVAULT_MODEL_PROVIDER:'mock',AIVAULT_MODEL_NAME:'contract-test',AIVAULT_MOCK_CONTRACT:'1'};

test('mock E2E reaches TESTING with zero mutation', async()=>{
  const output=JSON.stringify({edits:[{op:'replace_file',path:'agent/src/example.mjs',content:'export const ok=true;'}]});
  const r=await runP1MockE2E({input,instruction:'make safe change',env,transport:mockZeroCostTransport(output)});
  assert.equal(r.ok,true); assert.equal(r.task.state,'TESTING'); assert.equal(r.model_cost_usd,0); assert.equal(r.mutation_performed,false); assert.equal(r.tests_executed,false); assert.equal(r.draft_pr_created,false); assert.deepEqual(r.plan.files,['agent/src/example.mjs']);
});
test('unset kill switch fails closed before model configuration', async()=>{
  const r=await runP1MockE2E({input,instruction:'x',env:{},transport:mockZeroCostTransport('x')});
  assert.equal(r.ok,false); assert.equal(r.code,'BLOCKED_KILL_SWITCH'); assert.equal(r.task.state,'BLOCKED'); assert.equal(r.model_called,false); assert.equal(r.mutation_performed,false);
});
test('explicitly enabled runner without zero-paid policy stays blocked', async()=>{
  const r=await runP1MockE2E({input,instruction:'x',env:{AIVAULT_KILL_SWITCH:'0'},transport:mockZeroCostTransport('x')});
  assert.equal(r.ok,false); assert.equal(r.code,'BLOCKED_PAID_POLICY_UNSET'); assert.equal(r.task.state,'BLOCKED'); assert.equal(r.model_called,false);
});
test('safety-enabled runner without model reports BLOCKED_NO_MODEL', async()=>{
  const r=await runP1MockE2E({input,instruction:'x',env:{AIVAULT_KILL_SWITCH:'0',AIVAULT_ALLOW_PAID:'0'},transport:mockZeroCostTransport('x')});
  assert.equal(r.ok,false); assert.equal(r.code,'BLOCKED_NO_MODEL'); assert.equal(r.task.state,'BLOCKED'); assert.equal(r.model_called,false);
});
test('malicious model plan is blocked without mutation', async()=>{
  const output=JSON.stringify({edits:[{op:'replace_file',path:'index.html',content:'bad'}]});
  const r=await runP1MockE2E({input,instruction:'x',env,transport:mockZeroCostTransport(output)});
  assert.equal(r.ok,false); assert.equal(r.task.state,'BLOCKED'); assert.equal(r.mutation_performed,false); assert.equal(r.tests_executed,false); assert.equal(r.draft_pr_created,false);
});
