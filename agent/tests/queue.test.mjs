import test from 'node:test';import assert from 'node:assert/strict';import{InMemoryDryRunQueue}from'../src/queue.mjs';
test('dry-run queue is explicitly non-durable',()=>{const q=new InMemoryDryRunQueue();q.enqueue({task_id:'x'});assert.equal(q.durable,false);assert.equal(q.dequeue().task_id,'x');});
