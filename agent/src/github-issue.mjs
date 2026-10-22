const TASK_FENCE = /```aivault-agent-task\s*([\s\S]*?)```/i;

export function extractTaskFromIssueBody(body) {
  const match = String(body || '').match(TASK_FENCE);
  if (!match) return { ok: false, reason: 'STRUCTURED_TASK_NOT_FOUND' };
  try { return { ok: true, task: JSON.parse(match[1]) }; }
  catch { return { ok: false, reason: 'STRUCTURED_TASK_INVALID_JSON' }; }
}

export async function fetchIssueTask({ owner, repo, issueNumber, token, fetchImpl = fetch }) {
  if (!token) return { ok: false, reason: 'BLOCKED_GITHUB_TOKEN_UNAVAILABLE' };
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } });
  if (!response.ok) return { ok: false, reason: `GITHUB_ISSUE_HTTP_${response.status}` };
  const issue = await response.json();
  const parsed = extractTaskFromIssueBody(issue.body);
  if (!parsed.ok) return parsed;
  return { ok: true, task: parsed.task, actor: { github_user_id: issue.user?.id, login: issue.user?.login }, issue_url: issue.html_url };
}
