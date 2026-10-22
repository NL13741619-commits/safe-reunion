const TASK_FENCE=/```aivault-agent-task\s*([\s\S]*?)```/i;
export function extractTaskFromIssueBody(body){const m=String(body||'').match(TASK_FENCE);if(!m)return{ok:false,reason:'STRUCTURED_TASK_NOT_FOUND'};try{return{ok:true,task:JSON.parse(m[1])}}catch{return{ok:false,reason:'STRUCTURED_TASK_INVALID_JSON'}}}
