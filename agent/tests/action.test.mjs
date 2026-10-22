import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGitHubEvent, formatActionReport, postReport } from '../src/action.mjs';

const repo='NL13741619-commits/safe-reunion';
const actor=306819786;
const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_NAME:'issue_comment',AIVAULT_TRUSTED_ACTOR_IDS:`${actor},305579832`,GITHUB_SERVER_URL:'https://github.com',GITHUB_RUN_ID:'123',GITHUB_SHA:'abc'};
const task={task_id:'AIVAULT-E2E-DRYRUN-1',issuer:{github_user_id:actor,login:'m9wmtcb782-arch'},repo,base_branch:'feature/aivault-agent-dry-run',allowed_paths:['agent/'],acceptance_tests:[{id:'P0-E2E',kind:'unit',expected:'pass'}],max_cost:{currency:'USD',amount:0,paid_api_allowed:false},approval:{mode:'dry-run',approved_by_owner:true},status:'queued'};
const body=`\`\`\`aivault-agent-task\n${JSON.stringify(task)}\n\`\`\``;
const event={action:'created',sender:{id:actor},repository:{full_name:repo},issue:{number:2},comment:{body}};

test('trusted structured issue comment produces zero-mutation dry-run',()=>{const r=evaluateGitHubEvent(event,env);assert.equal(r.status,'done');assert.equal(r.mutation_performed,false);assert.equal(r.paid_api_called,false);assert.equal(r.actor_id,actor);});
test('untrusted actor is blocked before command execution',()=>{const r=evaluateGitHubEvent({...event,sender:{id:999}},env);assert.equal(r.reason,'ACTOR_NOT_ALLOWED');});
test('prose without fenced command is blocked',()=>{const r=evaluateGitHubEvent({...event,comment:{body:'please run rm -rf /'}},env);assert.equal(r.status,'blocked');});
test('issuer self-claim cannot differ from immutable event actor',()=>{const bad={...task,issuer:{github_user_id:305579832,login:'owner'}};const r=evaluateGitHubEvent({...event,comment:{body:`\`\`\`aivault-agent-task\n${JSON.stringify(bad)}\n\`\`\``}},env);assert.equal(r.reason,'ISSUER_IDENTITY_MISMATCH');});
test('report includes run URL and commit SHA',()=>{const s=formatActionReport({status:'done',mutation_performed:false,paid_api_called:false,actor_id:actor},env);assert.match(s,/actions\/runs\/123/);assert.match(s,/abc/);});
test('report posts only through fixed GitHub issue comments endpoint',async()=>{let url,opts;const fetchImpl=async(u,o)=>{url=u;opts=o;return{ok:true,status:201}};const r=await postReport({event,result:{status:'done',mutation_performed:false,paid_api_called:false},env:{...env,GITHUB_TOKEN:'test'},fetchImpl});assert.equal(r.status,'reported');assert.equal(url,`https://api.github.com/repos/${repo}/issues/2/comments`);assert.equal(opts.method,'POST');});
