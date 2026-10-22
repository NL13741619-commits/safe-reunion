import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWebhookServer } from '../src/webhook.mjs';

const secret='unit-secret';
function signed(body){return 'sha256='+crypto.createHmac('sha256',secret).update(body).digest('hex');}
const task={task_id:'AIVAULT-002-WEBHOOK',issuer:{github_user_id:42,login:'trusted'},repo:'NL13741619-commits/safe-reunion',base_branch:'feature/aivault-agent-dry-run',allowed_paths:['agent/'],acceptance_tests:[{id:'x',kind:'unit',expected:'pass'}],max_cost:{currency:'USD',amount:0,paid_api_allowed:false},approval:{mode:'dry-run',approved_by_owner:true},status:'queued'};
const config={secret,trustedIssuerIds:[42],repo:'NL13741619-commits/safe-reunion'};

test('signed Issue event automatically produces zero-mutation dry-run plan',async()=>{const server=createWebhookServer(config);await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;const body=JSON.stringify({action:'opened',sender:{id:42},repository:{full_name:task.repo},issue:{number:2,body:`\`\`\`aivault-agent-task\n${JSON.stringify(task)}\n\`\`\``}});const r=await fetch(`http://127.0.0.1:${port}/github/webhook`,{method:'POST',headers:{'x-hub-signature-256':signed(body),'x-github-delivery':'unit-delivery-1','x-github-event':'issues'},body});const data=await r.json();server.close();assert.equal(r.status,200);assert.equal(data.mutation_performed,false);assert.equal(data.status,'done');});
test('invalid signature is rejected before parsing command',async()=>{const server=createWebhookServer(config);await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;const r=await fetch(`http://127.0.0.1:${port}/github/webhook`,{method:'POST',headers:{'x-hub-signature-256':'sha256=bad','x-github-delivery':'unit-delivery-2','x-github-event':'issues'},body:'{}'});server.close();assert.equal(r.status,401);});
