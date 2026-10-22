import test from 'node:test';
import assert from 'node:assert/strict';
import { createTask, transition, claim, recoverExpiredLease, assertWorkspacePath, modelGate } from '../src/p1-runner.mjs';

test('task requires feature branch', () => assert.throws(() => createTask({task_id:'x',base_branch:'main'}), /INVALID_TASK/));
test('state machine follows guarded lifecycle', () => { const t=createTask({task_id:'x',base_branch:'feature/x'}); claim(t,'w',0,100); transition(t,'RUNNING'); transition(t,'TESTING'); transition(t,'PR_OPEN'); transition(t,'DONE'); assert.equal(t.state,'DONE'); });
test('invalid transition is rejected', () => { const t=createTask({task_id:'x',base_branch:'feature/x'}); assert.throws(() => transition(t,'DONE'), /INVALID_TRANSITION/); });
test('expired lease recovers to queue', () => { const t=createTask({task_id:'x',base_branch:'feature/x'}); claim(t,'w',0,10); assert.equal(recoverExpiredLease(t,11),true); assert.equal(t.state,'QUEUED'); });
test('workspace accepts agent paths only', () => assert.equal(assertWorkspacePath('agent/src/x.mjs'),'agent/src/x.mjs'));
test('workspace rejects traversal', () => assert.throws(() => assertWorkspacePath('agent/../index.html'), /PATH_DENIED/));
test('workspace rejects product root', () => assert.throws(() => assertWorkspacePath('index.html'), /PATH_OUTSIDE_WORKSPACE/));
test('workspace rejects workflow mutation', () => assert.throws(() => assertWorkspacePath('.github/workflows/x.yml'), /PATH_DENIED/));
test('model gate blocks missing credentials', () => assert.equal(modelGate({}).code,'BLOCKED_NO_MODEL'));
test('kill switch wins', () => assert.equal(modelGate({AIVAULT_KILL_SWITCH:'1',AIVAULT_MODEL_PROVIDER:'x',AIVAULT_MODEL_NAME:'y',AIVAULT_MODEL_TOKEN:'z'}).code,'BLOCKED_KILL_SWITCH'));
test('paid model enablement is denied', () => assert.equal(modelGate({AIVAULT_MODEL_PROVIDER:'x',AIVAULT_MODEL_NAME:'y',AIVAULT_MODEL_TOKEN:'z',AIVAULT_ALLOW_PAID:'1'}).code,'BLOCKED_PAID_MODEL'));
test('configured zero-cost model passes contract gate', () => assert.equal(modelGate({AIVAULT_MODEL_PROVIDER:'x',AIVAULT_MODEL_NAME:'y',AIVAULT_MODEL_TOKEN:'z'}).ok,true));
