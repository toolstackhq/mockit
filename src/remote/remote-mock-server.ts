import type { RemoteOverrideRequest, RequestJournalEntry, VerifyOptions } from '../core/types.js';
import { RemoteExpectBuilder } from './remote-expect-builder.js';

export interface RemoteMockRecord {
  id: string;
  method: string;
  path: string;
  priority: string;
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
    delay?: number;
    sequenceLength: number;
  };
  matchers: {
    headers: Record<string, string>;
    cookies: Record<string, string>;
    query: Record<string, string>;
    body: Array<{ jsonPath: string; matcher: string }>;
  };
  callCount: number;
  optional: boolean;
  persisted: boolean;
  remainingUses: number | null;
}

export interface RemoteVerificationEntry {
  id: string;
  path: string;
  method?: string;
  priority: string;
  callCount: number;
  isInvoked: boolean;
}

export interface RemoteVerificationExplanation {
  path: string;
  method?: string;
  priority?: string;
  id?: string;
  matchedMocks: number;
  totalCallCount: number;
  mocks: RemoteVerificationEntry[];
}

export class RemoteMockServer {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  expect(path: string): RemoteExpectBuilder {
    return new RemoteExpectBuilder(path, this);
  }

  async createOverride(request: RemoteOverrideRequest): Promise<RemoteMockRecord> {
    return this.requestJson('/_mockit/api/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  async resetOverrides(): Promise<void> {
    await this.requestVoid('/_mockit/api/overrides', { method: 'DELETE' });
  }

  async resetAll(): Promise<void> {
    await Promise.all([
      this.resetOverrides(),
      this.clearHistory(),
    ]);
  }

  async listOverrides(): Promise<RemoteMockRecord[]> {
    return this.requestJson('/_mockit/api/overrides');
  }

  async listMocks(): Promise<RemoteMockRecord[]> {
    return this.requestJson('/_mockit/api/mocks');
  }

  async listRequests(): Promise<RequestJournalEntry[]> {
    return this.requestJson('/_mockit/api/requests');
  }

  async listUnmatchedRequests(): Promise<RequestJournalEntry[]> {
    return this.requestJson('/_mockit/api/unmatched');
  }

  async clearHistory(): Promise<void> {
    await this.requestVoid('/_mockit/api/history', { method: 'DELETE' });
  }

  async pendingMocks(): Promise<RemoteMockRecord[]> {
    return this.requestJson('/_mockit/api/pending');
  }

  async isDone(): Promise<boolean> {
    return (await this.pendingMocks()).length === 0;
  }

  async verify(path: string, options: VerifyOptions = {}): Promise<boolean> {
    return (await this.getMatchingMocks(path, options)).some((mock) => mock.isInvoked);
  }

  async verifyCount(path: string, expectedCount: number, options: VerifyOptions = {}): Promise<boolean> {
    const total = (await this.getMatchingMocks(path, options))
      .reduce((sum, mock) => sum + mock.callCount, 0);
    return total === expectedCount;
  }

  async verifyNotCalled(path: string, options: VerifyOptions = {}): Promise<boolean> {
    return this.verifyCount(path, 0, options);
  }

  async explainVerification(path: string, options: VerifyOptions = {}): Promise<RemoteVerificationExplanation> {
    const mocks = await this.getMatchingMocks(path, options);
    const totalCallCount = mocks.reduce((sum, mock) => sum + mock.callCount, 0);

    return {
      path,
      method: options.method,
      priority: options.priority,
      id: options.id,
      matchedMocks: mocks.length,
      totalCallCount,
      mocks,
    };
  }

  private async getMatchingMocks(path: string, options: VerifyOptions): Promise<RemoteVerificationEntry[]> {
    const mocks = await this.listMocks();

    return mocks
      .filter((mock) => {
        if (mock.path !== path) return false;
        if (options.id && mock.id !== options.id) return false;
        if (options.method && mock.method !== options.method) return false;
        if (options.priority && mock.priority !== options.priority) return false;
        return true;
      })
      .map((mock) => ({
        id: mock.id,
        path: mock.path,
        method: mock.method === 'ANY' ? undefined : mock.method,
        priority: mock.priority,
        callCount: mock.callCount,
        isInvoked: mock.callCount > 0,
      }));
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      throw await this.toError(response);
    }
    return response.json() as Promise<T>;
  }

  private async requestVoid(path: string, init?: RequestInit): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      throw await this.toError(response);
    }
  }

  private async toError(response: Response): Promise<Error> {
    const body = await response.text();
    return new Error(`RemoteMockServer request failed (${response.status}): ${body || response.statusText}`);
  }
}
