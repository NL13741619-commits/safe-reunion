import { fetchIssueTask } from './github-issue.mjs';
import { validateTask, planDryRun } from './policy.mjs';
import { CodingModelAdapter } from './model.mjs';
import { TaskState } from './state.mjs';
import { formatDryRunComment, postIssueComment } from './reporter.mjs';

const [owner, repo] = (process.env.GITHUB_REPOSITORY || 'NL13741619-commits/safe-reunion').split('/');
const issueNumber = Number(process.env.AIVAULT_ISSUE_NUMBER || process.argv[2]);
if (!issueNumber) { console.error('AIVAULT_ISSUE_NUMBER or issue number argument required'); process.exit(2); }
const token=process.env.GITHUB_TOKEN;
const intake = await fetchIssueTask({ owner, repo, issueNumber, token });
if (!intake.ok) { console.log(JSON.stringify({status:'blocked',reason:intake.reason},null,2)); process.exit(1); }
if (intake.actor.github_user_id !== intake.task.issuer?.github_user_id) { console.log(JSON.stringify({status:'blocked',reason:'ISSUER_IDENTITY_MISMATCH'},null,2)); process.exit(1); }
const issuerIds=(process.env.AIVAULT_TRUSTED_ISSUER_IDS||'').split(',').filter(Boolean).map(Number);
const result=validateTask(intake.task,{repo:`${owner}/${repo}`,issuerIds});
if(!result.ok){console.log(JSON.stringify({status:'blocked',errors:result.errors},null,2));process.exit(1);}
const state=new TaskState(intake.task.task_id); state.transition('accepted').transition('running');
const model=new CodingModelAdapter();
const output={...planDryRun(intake.task),source:intake.issue_url,model:model.status()};
state.transition('done',{mutation_performed:false}); output.state_events=state.events;
if(process.env.AIVAULT_REPORT_TO_ISSUE==='true') output.report=await postIssueComment({owner,repo,issueNumber,token,body:formatDryRunComment(output)});
console.log(JSON.stringify(output,null,2));
