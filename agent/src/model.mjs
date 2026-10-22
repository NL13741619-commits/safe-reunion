export class CodingModelAdapter {
  constructor({ endpoint, apiKey, allowPaid = false, provider = 'openai-compatible', model } = {}) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.allowPaid = allowPaid;
    this.provider = provider;
    this.model = model;
  }
  status() {
    if (!this.endpoint || !this.apiKey || !this.model) return { configured: false, reason: 'BLOCKED_MODEL_UNAVAILABLE' };
    if (!this.allowPaid) return { configured: false, reason: 'BLOCKED_PAID_API_NOT_APPROVED' };
    return { configured: true, provider: this.provider, model: this.model };
  }
  async generatePatch({ messages, fetchImpl = fetch }) {
    const s = this.status();
    if (!s.configured) throw new Error(s.reason);
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('INVALID_MODEL_REQUEST');
    const response = await fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages, temperature: 0 })
    });
    if (!response.ok) throw new Error(`MODEL_HTTP_${response.status}`);
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('MODEL_EMPTY_RESPONSE');
    return { content, usage: data.usage ?? null, provider: this.provider, model: this.model };
  }
}
