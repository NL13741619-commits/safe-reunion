import crypto from 'node:crypto';

export function verifyWebhookSignature(rawBody, signature, secret) {
  if (!secret || !signature?.startsWith('sha256=')) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export class ReplayGuard {
  constructor() { this.deliveries = new Map(); this.tasks = new Map(); }
  accept(deliveryId, taskId, payloadHash) {
    if (!deliveryId || !taskId || !payloadHash) return { ok: false, reason: 'MISSING_REPLAY_KEY' };
    if (this.deliveries.has(deliveryId)) return { ok: false, reason: 'DUPLICATE_DELIVERY' };
    const old = this.tasks.get(taskId);
    if (old && old !== payloadHash) return { ok: false, reason: 'TASK_ID_CONFLICT' };
    if (old === payloadHash) return { ok: false, reason: 'DUPLICATE_TASK' };
    this.deliveries.set(deliveryId, payloadHash);
    this.tasks.set(taskId, payloadHash);
    return { ok: true };
  }
}

export function hashPayload(rawBody) { return crypto.createHash('sha256').update(rawBody).digest('hex'); }
