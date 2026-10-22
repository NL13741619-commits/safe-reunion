import http from 'node:http';
import { verifyWebhookSignature, ReplayGuard, hashPayload } from './receiver.mjs';
import { extractTaskFromIssueBody } from './github-issue.mjs';
import { validateTask, planDryRun } from './policy.mjs';
import { TaskState } from './state.mjs';

const replay=new ReplayGuard();
function reply(res,code,data){res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(data));}

export function createWebhookServer({secret=process.env.GITHUB_WEBHOOK_SECRET,trustedIssuerIds=(process.env.AIVAULT_TRUSTED_ISSUER_IDS||'').split(',').filter(Boolean).map(Number),repo=process.env.GITHUB_REPOSITORY||'NL13741619-commits/safe-reunion'}={}){return http.createServer((req,res)=>{
  if(req.method!=='POST'||req.url!=='/github/webhook')return reply(res,404,{status:'not_found'});
  const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{
    const raw=Buffer.concat(chunks); const sig=req.headers['x-hub-signature-256'];
    if(!verifyWebhookSignature(raw,sig,secret))return reply(res,401,{status:'blocked',reason:'INVALID_WEBHOOK_SIGNATURE'});
    const delivery=req.headers['x-github-delivery']; const event=req.headers['x-github-event'];
    if(event!=='issues')return reply(res,202,{status:'ignored',reason:'EVENT_NOT_SUPPORTED'});
    let payload;try{payload=JSON.parse(raw.toString('utf8'));}catch{return reply(res,400,{status:'blocked',reason:'INVALID_JSON'});}
    if(!['opened','edited','reopened'].includes(payload.action))return reply(res,202,{status:'ignored',reason:'ISSUE_ACTION_NOT_SUPPORTED'});
    const parsed=extractTaskFromIssueBody(payload.issue?.body); if(!parsed.ok)return reply(res,202,{status:'blocked',reason:parsed.reason});
    const task=parsed.task; const actorId=payload.sender?.id; if(actorId!==task.issuer?.github_user_id)return reply(res,403,{status:'blocked',reason:'ISSUER_IDENTITY_MISMATCH'});
    const fullName=payload.repository?.full_name; if(fullName!==repo)return reply(res,403,{status:'blocked',reason:'REPO_NOT_ALLOWED'});
    const replayResult=replay.accept(delivery,task.task_id,hashPayload(raw)); if(!replayResult.ok)return reply(res,409,{status:'blocked',reason:replayResult.reason});
    const validation=validateTask(task,{repo,issuerIds:trustedIssuerIds}); if(!validation.ok)return reply(res,403,{status:'blocked',errors:validation.errors});
    const state=new TaskState(task.task_id);state.transition('accepted').transition('running');const plan=planDryRun(task);state.transition('done',{mutation_performed:false});
    return reply(res,200,{...plan,issue_number:payload.issue?.number,state_events:state.events});
  });
});}

if(import.meta.url===`file://${process.argv[1]}`){const secret=process.env.GITHUB_WEBHOOK_SECRET;if(!secret){console.error('GITHUB_WEBHOOK_SECRET required');process.exit(2);}const port=Number(process.env.PORT||8787);createWebhookServer({secret}).listen(port,()=>console.log(`dry-run webhook listening on ${port}`));}
