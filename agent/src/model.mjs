export class CodingModelAdapter {
  constructor({ endpoint, apiKey, allowPaid = false } = {}) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.allowPaid = allowPaid;
  }
  status() {
    if (!this.endpoint || !this.apiKey) return { configured: false, reason: 'BLOCKED_MODEL_UNAVAILABLE' };
    if (!this.allowPaid) return { configured: false, reason: 'BLOCKED_PAID_API_NOT_APPROVED' };
    return { configured: true };
  }
  async generatePatch() {
    const s = this.status();
    if (!s.configured) throw new Error(s.reason);
    throw new Error('EXECUTION_MODE_NOT_IMPLEMENTED');
  }
}
