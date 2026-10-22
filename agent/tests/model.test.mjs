import test from 'node:test';
import assert from 'node:assert/strict';
import { CodingModelAdapter } from '../src/model.mjs';

test('model adapter blocks when no real model credential is configured',()=>assert.equal(new CodingModelAdapter().status().reason,'BLOCKED_MODEL_UNAVAILABLE'));
test('model adapter blocks paid use without approval',()=>assert.equal(new CodingModelAdapter({endpoint:'https://example.invalid',apiKey:'secret',allowPaid:false}).status().reason,'BLOCKED_PAID_API_NOT_APPROVED'));
