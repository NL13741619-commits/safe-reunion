import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDryRunComment, postIssueComment } from '../src/reporter.mjs';
test('report states zero mutation and blocked model truthfully',()=>{const s=formatDryRunComment({task_id:'x',status:'done',mutation_performed:false,paid_api_called:false,model:{configured:false,reason:'BLOCKED_MODEL_UNAVAILABLE'}});assert.match(s,/mutation_performed: false/);assert.match(s,/BLOCKED_MODEL_UNAVAILABLE/);});
test('reporter refuses to post without GitHub token',async()=>assert.equal((await postIssueComment({owner:'o',repo:'r',issueNumber:2,body:'x'})).reason,'BLOCKED_GITHUB_TOKEN_UNAVAILABLE'));
