import fs from 'node:fs/promises';
import { validateTask, planDryRun } from './policy.mjs';
import { CodingModelAdapter } from './model.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: npm run dry-run -- <task.json>'); process.exit(2); }
const task = JSON.parse(await fs.readFile(file, 'utf8'));
const issuerIds = (process.env.AIVAULT_TRUSTED_ISSUER_IDS || '').split(',').filter(Boolean).map(Number);
const policy = { repo: 'NL13741619-commits/safe-reunion', issuerIds };
const validation = validateTask(task, policy);
if (!validation.ok) { console.log(JSON.stringify({ status: 'blocked', errors: validation.errors }, null, 2)); process.exit(1); }
const model = new CodingModelAdapter();
console.log(JSON.stringify({ ...planDryRun(task), model: model.status() }, null, 2));
