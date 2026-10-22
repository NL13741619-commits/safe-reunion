import { modelGate } from './p1-runner.mjs';

export class ModelAdapter {
  constructor({ env = process.env, transport } = {}) {
    this.env = env;
    this.transport = transport;
  }

  async generate({ task, instruction }) {
    const gate = modelGate(this.env);
    if (!gate.ok) return { ...gate, called: false, cost_usd: 0 };
    if (typeof this.transport !== 'function') return { ok: false, code: 'BLOCKED_NO_TRANSPORT', called: false, cost_usd: 0 };
    if (gate.mock === true && this.transport.aivaultMockTransport !== true) return { ok: false, code: 'BLOCKED_UNTRUSTED_MOCK_TRANSPORT', called: false, cost_usd: 0 };

    const request = {
      provider: gate.provider,
      model: gate.model,
      task_id: task.task_id,
      instruction: String(instruction || '').slice(0, 4000),
      constraints: { workspace: 'agent/', paid_api: false, direct_main_push: false, auto_merge: false }
    };
    const response = await this.transport(request);
    if (!response || typeof response.output !== 'string') return { ok: false, code: 'MODEL_BAD_RESPONSE', called: true, cost_usd: 0 };
    if (Number(response.cost_usd || 0) !== 0) return { ok: false, code: 'MODEL_NONZERO_COST', called: true, cost_usd: Number(response.cost_usd) };
    return { ok: true, called: true, cost_usd: 0, output: response.output.slice(0, 12000), provider: gate.provider, model: gate.model };
  }
}

export function mockZeroCostTransport(output = 'NOOP') {
  const transport = async () => ({ output, cost_usd: 0 });
  transport.aivaultMockTransport = true;
  return transport;
}
