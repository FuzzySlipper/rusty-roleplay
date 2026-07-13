export class RustyCrewApiClient {
  constructor({ baseUrl = 'http://127.0.0.1:9348', token, fetchImpl = fetch } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.fetchImpl = fetchImpl;
  }

  async request(method, path, body) {
    const headers = new Headers({ accept: 'application/json' });
    if (body !== undefined) headers.set('content-type', 'application/json');
    if (this.token) headers.set('authorization', `Bearer ${this.token}`);
    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new Error(
        `Could not reach rusty-crew at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const text = await response.text();
    let envelope;
    try {
      envelope = text === '' ? {} : JSON.parse(text);
    } catch {
      throw new Error(`rusty-crew returned non-JSON response ${response.status}: ${text.slice(0, 240)}`);
    }
    if (!response.ok || envelope.ok === false) {
      const detail = envelope.error?.message ?? envelope.error?.reason_code ?? response.statusText;
      throw new Error(`rusty-crew ${method} ${path} failed (${response.status}): ${detail}`);
    }
    return envelope.data ?? envelope;
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body) {
    return this.request('POST', path, body);
  }

  patch(path, body) {
    return this.request('PATCH', path, body);
  }

  delete(path) {
    return this.request('DELETE', path);
  }
}
