import { createTask, claim, transitionOwned, assertLeaseOwner } from './p1-runner.mjs';
import { ModelAdapter } from './p1-model-adapter.mjs';
import { parseEditPlan, summarizePlan } from './p1-planner.mjs';

export async function runP1MockE2E({ input, instruction, env = {}, transport, workerId = 'p1-worker', now = 0 }) {
  const task = createTask(input);
  claim(task, workerId, now, 60_000);
  assertLeaseOwner(task, workerId, now + 1);
  transitionOwned(task, 'RUNNING', workerId, now + 1, 'authorized isolated runner');

  const model = await new ModelAdapter({ env, transport }).generate({ task, instruction });
  if (!model.ok) {
    transitionOwned(task, 'BLOCKED', workerId, now + 2, model.code);
    return { ok: false, code: model.code, task, model_called: model.called === true, mutation_performed: false, tests_executed: false, draft_pr_created: false };
  }

  const plan = parseEditPlan(model.output);
  if (!plan.ok) {
    transitionOwned(task, 'FAILED', workerId, now + 2, plan.code);
    transitionOwned(task, 'BLOCKED', workerId, now + 3, plan.code);
    return { ok: false, code: plan.code, task, model_called: true, mutation_performed: false, tests_executed: false, draft_pr_created: false };
  }

  transitionOwned(task, 'TESTING', workerId, now + 2, 'mock plan validated; no filesystem mutation');
  return {
    ok: true,
    code: 'MOCK_READY_FOR_SANDBOX',
    task,
    model_called: true,
    model_cost_usd: model.cost_usd,
    mutation_performed: false,
    tests_executed: false,
    draft_pr_created: false,
    plan: summarizePlan(plan)
  };
}
