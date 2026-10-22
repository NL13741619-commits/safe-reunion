import { spawn } from 'node:child_process';

const ALLOWED = new Map([
  ['agent-unit', { cmd: process.execPath, args: ['--test', 'tests'] }]
]);

export function getAllowedTest(id) { return ALLOWED.get(id) ?? null; }

export async function runAllowedTest(id, { cwd, timeoutMs = 120000 } = {}) {
  const spec = getAllowedTest(id);
  if (!spec) return { ok:false, reason:'TEST_NOT_ALLOWLISTED' };
  return await new Promise(resolve => {
    const child=spawn(spec.cmd,spec.args,{cwd,shell:false,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');},timeoutMs);
    child.stdout.on('data',d=>stdout+=d);
    child.stderr.on('data',d=>stderr+=d);
    child.on('close',(code,signal)=>{clearTimeout(timer);resolve({ok:code===0,code,signal,stdout:stdout.slice(-20000),stderr:stderr.slice(-20000)});});
  });
}
