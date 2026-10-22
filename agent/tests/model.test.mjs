import test from 'node:test';
import assert from 'node:assert/strict';
import { CodingModelAdapter } from '../src/model.mjs';

test('model adapter blocks when no real model credential is configured',()=>assert.equal(new CodingModelAdapter().status().reason,'BLOCKED_MODEL_UNAVAILABLE'));
test('model adapter blocks paid use without approval',()=>assert.equal(new CodingModelAdapter({endpoint:'https://example.invalid',apiKey:'secret',model:'real-model',allowPaid:false}).status().reason,'BLOCKED_PAID_API_NOT_APPROVED'));
test('authorized adapter calls configured OpenAI-compatible model endpoint',async()=>{ let request; const fake=async(url,init)=>{request={url,init};return{ok:true,json:async()=>({choices:[{message:{content:'patch-plan'}}],usage:{total_tokens:7}})}}; const a=new CodingModelAdapter({endpoint:'https://model.example/v1/chat/completions',apiKey:'k',model:'coding-model',allowPaid:true}); const r=await a.generatePatch({messages:[{role:'user',content:'fix'}],fetchImpl:fake}); assert.equal(r.content,'patch-plan'); assert.equal(request.url,'https://model.example/v1/chat/completions'); assert.match(request.init.headers.authorization,/Bearer/); });
