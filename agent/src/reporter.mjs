export function formatDryRunComment(result) {
  const model=result.model?.configured ? `${result.model.provider}/${result.model.model}` : result.model?.reason || 'not configured';
  return [
    '## AIVAULT Agent dry-run result',
    '',
    `- task_id: ${result.task_id}`,
    `- status: ${result.status}`,
    `- mutation_performed: ${Boolean(result.mutation_performed)}`,
    `- paid_api_called: ${Boolean(result.paid_api_called)}`,
    `- coding_model: ${model}`,
    '',
    'Execution-mode mutation remains disabled pending explicit approval.'
  ].join('\n');
}

export async function postIssueComment({owner,repo,issueNumber,token,body,fetchImpl=fetch}) {
  if(!token) return {ok:false,reason:'BLOCKED_GITHUB_TOKEN_UNAVAILABLE'};
  const r=await fetchImpl(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,{method:'POST',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({body})});
  if(!r.ok)return{ok:false,reason:`GITHUB_COMMENT_HTTP_${r.status}`};
  const data=await r.json();return{ok:true,url:data.html_url,id:data.id};
}
