import type { MockPriority, RecordedRequest, RequestJournalEntry, NearMiss, MockResponse } from './types.js';
import { MockDefinition } from './mock-definition.js';
import { evaluateBodyMatcher } from '../matchers/body-matchers.js';

const PRIORITY_ORDER: Record<MockPriority, number> = {
  override: 0,
  default: 1,
  swagger: 2,
};

interface ParsedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  query: Record<string, string>;
  body: any;
}

interface ScoredCandidate {
  mock: MockDefinition;
  score: number;
  reasons: string[];
}

export interface ResolutionResult {
  mock: MockDefinition | null;
  response: MockResponse | null;
  nearMisses: NearMiss[];
}

export class MockRegistry {
  private mocks: MockDefinition[] = [];
  private journal: RequestJournalEntry[] = [];

  add(mock: MockDefinition): void {
    this.mocks.push(mock);
  }

  remove(id: string): boolean {
    const idx = this.mocks.findIndex(m => m.id === id);
    if (idx === -1) return false;
    this.mocks.splice(idx, 1);
    return true;
  }

  clear(priority?: MockPriority): void {
    if (priority) {
      this.mocks = this.mocks.filter(m => m.priority !== priority);
    } else {
      this.mocks = [];
    }
  }

  resolve(request: ParsedRequest): MockDefinition | null {
    return this.resolveDetailed(request).mock;
  }

  resolveDetailed(request: ParsedRequest): ResolutionResult {
    const candidates: ScoredCandidate[] = [];
    const nearMisses: NearMiss[] = [];

    for (const mock of this.mocks) {
      const result = this.scoreMock(mock, request);
      if (result.matched) {
        candidates.push({ mock, score: result.score, reasons: [] });
      } else {
        nearMisses.push({
          id: mock.id,
          path: mock.path,
          method: mock.method,
          priority: mock.priority,
          score: result.score,
          reasons: result.reasons,
        });
      }
    }

    if (candidates.length === 0) {
      return {
        mock: null,
        response: null,
        nearMisses: nearMisses
          .sort((a, b) => b.score - a.score)
          .slice(0, 3),
      };
    }

    candidates.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.mock.priority] - PRIORITY_ORDER[b.mock.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.score - a.score;
    });

    const winner = candidates[0].mock;
    const response = winner.nextResponse();

    const recorded: RecordedRequest = {
      method: request.method,
      path: request.path,
      headers: request.headers,
      cookies: request.cookies,
      query: request.query,
      body: request.body,
      timestamp: Date.now(),
    };
    winner.recordCall(recorded);

    return {
      mock: winner,
      response,
      nearMisses: [],
    };
  }

  listMocks(): MockDefinition[] {
    return [...this.mocks];
  }

  listRequests(): RequestJournalEntry[] {
    return [...this.journal];
  }

  listUnmatchedRequests(): RequestJournalEntry[] {
    return this.journal.filter(entry => !entry.matched);
  }

  clearJournal(): void {
    this.journal = [];
  }

  pendingMocks(): MockDefinition[] {
    return this.mocks.filter(mock => mock.isPending());
  }

  recordMatched(request: ParsedRequest, mock: MockDefinition, response: MockResponse): void {
    this.journal.push({
      ...this.toRecordedRequest(request),
      matched: true,
      proxied: false,
      mockId: mock.id,
      mockPath: mock.path,
      mockPriority: mock.priority,
      responseStatus: response.status,
      nearMisses: [],
    });
  }

  recordUnmatched(request: ParsedRequest, nearMisses: NearMiss[]): void {
    this.journal.push({
      ...this.toRecordedRequest(request),
      matched: false,
      proxied: false,
      nearMisses,
    });
  }

  recordProxied(request: ParsedRequest, responseStatus: number, nearMisses: NearMiss[]): void {
    this.journal.push({
      ...this.toRecordedRequest(request),
      matched: false,
      proxied: true,
      responseStatus,
      nearMisses,
    });
  }

  recordProxyMock(request: ParsedRequest, response: MockResponse): MockDefinition {
    const existing = this.mocks.find((mock) =>
      mock.priority === 'default'
      && mock.path === request.path
      && mock.method === request.method.toUpperCase()
      && this.queryMatchersEqual(mock, request.query)
    );

    if (existing) {
      existing.response = response;
      return existing;
    }

    const mock = new MockDefinition(request.path, 'default');
    mock.method = request.method.toUpperCase() as MockDefinition['method'];
    mock.response = response;
    for (const [key, value] of Object.entries(request.query)) {
      mock.queryMatchers.set(key, {
        name: `equals('${value}')`,
        match: (candidate: string) => candidate === value,
      });
    }
    this.add(mock);
    return mock;
  }

  private scoreMock(
    mock: MockDefinition,
    request: ParsedRequest,
  ): { matched: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    if (mock.isExhausted()) {
      reasons.push('mock is exhausted');
      return { matched: false, score, reasons };
    }

    const normalizedMethod = request.method.toUpperCase();

    if (mock.method) {
      if (mock.method !== normalizedMethod) {
        reasons.push(`method mismatch: expected ${mock.method}, got ${normalizedMethod}`);
      } else {
        score++;
      }
    }

    if (!this.matchPath(mock.path, request.path)) {
      reasons.push(`path mismatch: expected ${mock.path}, got ${request.path}`);
    } else {
      score++;
    }

    for (const [name, matcher] of mock.headerMatchers) {
      const value = request.headers[name];
      if (value === undefined) {
        reasons.push(`missing header: ${name}`);
      } else if (!matcher.match(value)) {
        reasons.push(`header mismatch: ${name} did not satisfy ${matcher.name}`);
      } else {
        score++;
      }
    }

    for (const [name, matcher] of mock.cookieMatchers) {
      const value = request.cookies[name];
      if (value === undefined) {
        reasons.push(`missing cookie: ${name}`);
      } else if (!matcher.match(value)) {
        reasons.push(`cookie mismatch: ${name} did not satisfy ${matcher.name}`);
      } else {
        score++;
      }
    }

    for (const [name, matcher] of mock.queryMatchers) {
      const value = request.query[name];
      if (value === undefined) {
        reasons.push(`missing query: ${name}`);
      } else if (!matcher.match(value)) {
        reasons.push(`query mismatch: ${name} did not satisfy ${matcher.name}`);
      } else {
        score++;
      }
    }

    for (const { jsonPath, matcher } of mock.bodyMatchers) {
      if (!evaluateBodyMatcher(request.body, jsonPath, matcher)) {
        reasons.push(`body mismatch: ${jsonPath} did not satisfy ${matcher.name}`);
      } else {
        score++;
      }
    }

    return { matched: reasons.length === 0, score, reasons };
  }

  private matchPath(pattern: string, actual: string): boolean {
    const patternParts = pattern.split('/').filter(Boolean);
    const actualParts = actual.split('/').filter(Boolean);

    if (patternParts.length !== actualParts.length) return false;

    return patternParts.every((part, i) => {
      if (part.startsWith(':')) return true;
      return part === actualParts[i];
    });
  }

  private toRecordedRequest(request: ParsedRequest): RecordedRequest {
    return {
      method: request.method,
      path: request.path,
      headers: request.headers,
      cookies: request.cookies,
      query: request.query,
      body: request.body,
      timestamp: Date.now(),
    };
  }

  private queryMatchersEqual(mock: MockDefinition, query: Record<string, string>): boolean {
    if (mock.queryMatchers.size !== Object.keys(query).length) return false;
    for (const [key, value] of Object.entries(query)) {
      const matcher = mock.queryMatchers.get(key);
      if (!matcher || !matcher.match(value)) return false;
    }
    return true;
  }
}
