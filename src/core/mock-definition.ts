import { randomUUID } from 'node:crypto';
import type { MockDefinitionData, HttpMethod, MockPriority, MockResponse, Matcher, BodyMatcher, RecordedRequest } from './types.js';

export class MockDefinition implements MockDefinitionData {
  id: string;
  path: string;
  method?: HttpMethod;
  priority: MockPriority;
  headerMatchers: Map<string, Matcher<string>>;
  queryMatchers: Map<string, Matcher<string>>;
  bodyMatchers: BodyMatcher[];
  response: MockResponse;
  callCount: number;
  calls: RecordedRequest[];

  constructor(path: string, priority: MockPriority = 'override') {
    this.id = randomUUID();
    this.path = path;
    this.priority = priority;
    this.headerMatchers = new Map();
    this.queryMatchers = new Map();
    this.bodyMatchers = [];
    this.response = { status: 200, headers: {}, body: null };
    this.callCount = 0;
    this.calls = [];
  }

  recordCall(request: RecordedRequest): void {
    this.callCount++;
    this.calls.push(request);
  }

  get matcherCount(): number {
    return this.headerMatchers.size + this.queryMatchers.size + this.bodyMatchers.length + (this.method ? 1 : 0);
  }
}
