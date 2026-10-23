import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTask, claim, transitionOwned, assertLeaseOwner } from './p1-runner.mjs';
import { ModelAdapter } from './p1-model-adapter.mjs';
import { parseEditPlan, summarizePlan } from './p1-planner.mjs';
import { applyCreateOnlyPlan } from './p1-sandbox.mjs';

export async function runP1MockE2E({ input, instruction, env = {}, transport, workerId = 'p1-worker', now = 0, taskStore }) {
  const storedInput = { ...input, instruction };
  const task = taskStore ? await taskStore.claim(storedInput, workerId, now, 60_000) : createTask(input);
  if (!taskStore) claim(task, workerId, now, 60_000);
  async function move(next, at, detail) {
    if (taskStore) {
      const saved = await taskStore.transition(storedInput, workerId, next, at, detail);
      Object.assign(task, saved.record.task);
    } else transitionOwned(task, next, workerId, at, detail);
  }
  assertLeaseOwner(task, workerId, now + 1);
  await move('RUNNING', now + 1, 'authorized isolated runner');

  const model = await new ModelAdapter({ env, transport }).generate({ task, instruction });
  if (!model.ok) {
    await move('BLOCKED', now + 2, model.code);
    return { ok: false, code: model.code, task, model_called: model.called === true, mutation_performed: false, tests_executed: false, draft_pr_created: false };
  }

  const plan = parseEditPlan(model.output);
  if (!plan.ok) {
    await move('FAILED', now + 2, plan.code);
    await move('BLOCKED', now + 3, plan.code);
    return { ok: false, code: plan.code, task, model_called: true, mutation_performed: false, tests_executed: false, draft_pr_created: false };
  }

  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'aivault-p1-e2e-'));
  try {
    const sandbox = await applyCreateOnlyPlan({ workspaceRoot, plan });
    await move('TESTING', now + 2, 'mock plan applied to disposable sandbox');
    return {
      ok: true,
      code: 'MOCK_SANDBOX_APPLIED',
      task,
      model_called: true,
      model_cost_usd: model.cost_usd,
      mutation_performed: sandbox.written.length > 0,
      mutation_scope: 'disposable_temp_workspace_only',
      production_mutation: false,
      written_files: sandbox.written,
      tests_executed: false,
      draft_pr_created: false,
      plan: summarizePlan(plan)
    };
  } catch (error) {
    await move('FAILED', now + 2, String(error?.message || 'SANDBOX_FAILED'));
    await move('BLOCKED', now + 3, String(error?.message || 'SANDBOX_FAILED'));
    return { ok: false, code: String(error?.message || 'SANDBOX_FAILED'), task, model_called: true, mutation_performed: false, production_mutation: false, tests_executed: false, draft_pr_created: false };
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

