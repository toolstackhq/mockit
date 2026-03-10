import type { MockPriority, RecordedRequest } from './types.js';
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

export class MockRegistry {
  private mocks: MockDefinition[] = [];

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
    const candidates: Array<{ mock: MockDefinition; score: number }> = [];

    for (const mock of this.mocks) {
      const score = this.scoreMock(mock, request);
      if (score >= 0) {
        candidates.push({ mock, score });
      }
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.mock.priority] - PRIORITY_ORDER[b.mock.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.score - a.score;
    });

    const winner = candidates[0].mock;

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

    return winner;
  }

  listMocks(): MockDefinition[] {
    return [...this.mocks];
  }

  private scoreMock(mock: MockDefinition, request: ParsedRequest): number {
    // Check method
    if (mock.method && mock.method !== request.method.toUpperCase()) return -1;

    // Check path
    if (!this.matchPath(mock.path, request.path)) return -1;

    let score = 0;

    // Score method match
    if (mock.method) score++;

    // Check & score header matchers
    for (const [name, matcher] of mock.headerMatchers) {
      const value = request.headers[name];
      if (value === undefined || !matcher.match(value)) return -1;
      score++;
    }

    // Check & score cookie matchers
    for (const [name, matcher] of mock.cookieMatchers) {
      const value = request.cookies[name];
      if (value === undefined || !matcher.match(value)) return -1;
      score++;
    }

    // Check & score query matchers
    for (const [name, matcher] of mock.queryMatchers) {
      const value = request.query[name];
      if (value === undefined || !matcher.match(value)) return -1;
      score++;
    }

    // Check & score body matchers
    for (const { jsonPath, matcher } of mock.bodyMatchers) {
      if (!evaluateBodyMatcher(request.body, jsonPath, matcher)) return -1;
      score++;
    }

    return score;
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
}
