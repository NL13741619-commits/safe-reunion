import test from'node:test';import assert from'node:assert/strict';import{validateTaskShape}from'../src/schema.mjs';
test('malformed task is rejected before policy',()=>{const r=validateTaskShape({task_id:'x'});assert.equal(r.ok,false);assert.ok(r.errors.includes('MISSING:issuer'));});
