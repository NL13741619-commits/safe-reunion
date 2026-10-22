import fs from 'node:fs/promises';
import { extractTaskFromIssueBody } from './github-issue.mjs';
import { validateTaskShape } from './schema.mjs';
import { validateTask, planDryRun } from './policy.mjs';

const BLOCK = (reason, extra={}) => ({status:'blocked',reason,mutation_performed:false,paid_api_called:false,...extra});

export function evaluateGitHubEvent(event, env={}) {
  const expectedRepo = env.GITHUB_REPOSITORY || 'NL13741619-commits/safe-reunion';
  const trusted = new Set(String(env.AIVAULT_TRUSTED_ACTOR_IDS || '').split(',').filter(Boolean).map(Number));
  const repo = event?.repository?.full_name;
  const actorId = Number(event?.sender?.id);
  const eventName = env.GITHUB_EVENT_NAME || '';
  if (repo !== expectedRepo) return BLOCK('REPOSITORY_NOT_ALLOWED');
  if (!trusted.has(actorId)) return BLOCK('ACTOR_NOT_ALLOWED');
  if (!['issues','issue_comment','pull_request'].includes(eventName)) return BLOCK('EVENT_NOT_ALLOWED');

  if (eventName === 'pull_request') {
    return {status:'test_only',mutation_performed:false,paid_api_called:false,reason:'PULL_REQUEST_CI_ONLY'};
  }

  const action = event?.action;
  if (eventName === 'issues' && !['opened','edited','reopened'].includes(action)) return BLOCK('ACTION_NOT_ALLOWED');
  if (eventName === 'issue_comment' && !['created','edited'].includes(action)) return BLOCK('ACTION_NOT_ALLOWED');

  const source = eventName === 'issue_comment' ? event?.comment?.body : event?.issue?.body;
  const parsed = extractTaskFromIssueBody(source || '');
  if (!parsed.ok) return BLOCK(parsed.reason || 'COMMAND_NOT_FOUND');
  const task = parsed.task;
  const shape = validateTaskShape(task);
  if (!shape.ok) return BLOCK('SCHEMA_INVALID',{errors:shape.errors});
  if (Number(task?.issuer?.github_user_id) !== actorId) return BLOCK('ISSUER_IDENTITY_MISMATCH');
  const policy = validateTask(task,{repo:expectedRepo,issuerIds:[...trusted]});
  if (!policy.ok) return BLOCK('POLICY_REJECTED',{errors:policy.errors});
  return {...planDryRun(task),status:'done',mutation_performed:false,paid_api_called:false,actor_id:actorId,execution_mode:'dry-run'};
}

export function formatActionReport(result, env={}) {
  const server=env.GITHUB_SERVER_URL || 'https://github.com';
  const repo=env.GITHUB_REPOSITORY || 'unknown/unknown';
  const runId=env.GITHUB_RUN_ID || 'unknown';
  const sha=env.GITHUB_SHA || 'unknown';
  const runUrl=`${server}/${repo}/actions/runs/${runId}`;
  const details=result.errors?.length?`\n- errors: \`${result.errors.join(', ')}\``:'';
  return `## AIVAULT Agent automated dry-run\n- status: **${result.status}**\n- execution_mode: \`${result.execution_mode || 'dry-run'}\`\n- mutation_performed: \`${Boolean(result.mutation_performed)}\`\n- paid_api_called: \`${Boolean(result.paid_api_called)}\`\n- blocked_reason: \`${result.reason || 'none'}\`\n- actor_id: \`${result.actor_id || 'n/a'}\`\n- commit_sha: \`${sha}\`\n- actions_run: ${runUrl}${details}`;
}

export async function postReport({event,result,env=process.env,fetchImpl=fetch}) {
  const issueNumber=event?.issue?.number;
  const token=env.GITHUB_TOKEN;
  if (!issueNumber) return BLOCK('ISSUE_NUMBER_UNAVAILABLE');
  if (!token) return BLOCK('GITHUB_TOKEN_UNAVAILABLE');
  const url=`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues/${issueNumber}/comments`;
  const r=await fetchImpl(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({body:formatActionReport(result,env)})});
  if(!r.ok) return BLOCK('ISSUE_REPORT_FAILED',{http_status:r.status});
  return {status:'reported'};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const eventPath=process.env.GITHUB_EVENT_PATH;
  if(!eventPath){console.error('GITHUB_EVENT_PATH required');process.exit(2);}
  const event=JSON.parse(await fs.readFile(eventPath,'utf8'));
  const result=evaluateGitHubEvent(event,process.env);
  const shouldReport=['issues','issue_comment'].includes(process.env.GITHUB_EVENT_NAME || '') && result.reason !== 'ACTOR_NOT_ALLOWED';
  const report=shouldReport ? await postReport({event,result}) : {status:'not_reported'};
  console.log(JSON.stringify({result,report},null,2));
  if(result.status==='blocked') process.exitCode=1;
}
