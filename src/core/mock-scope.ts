import { MockRegistry } from './mock-registry.js';
import { ExpectBuilder } from '../builder/expect-builder.js';
import type { MockDefinition } from './mock-definition.js';
import type { VerifyOptions, VerificationExplanation, RequestJournalEntry } from './types.js';

export class MockIt {
  protected registry: MockRegistry;

  constructor() {
    this.registry = new MockRegistry();
  }

  expect(path: string): ExpectBuilder {
    return new ExpectBuilder(path, (def) => {
      this.registry.add(def);
    });
  }

  resetOverrides(): void {
    this.registry.clear('override');
  }

  resetAll(): void {
    this.registry.clear();
  }

  listMocks(): MockDefinition[] {
    return this.registry.listMocks();
  }

  listRequests(): RequestJournalEntry[] {
    return this.registry.listRequests();
  }

  listUnmatchedRequests(): RequestJournalEntry[] {
    return this.registry.listUnmatchedRequests();
  }

  clearJournal(): void {
    this.registry.clearJournal();
  }

  pendingMocks(): MockDefinition[] {
    return this.registry.pendingMocks();
  }

  isDone(): boolean {
    return this.pendingMocks().length === 0;
  }

  verify(path: string, options: VerifyOptions = {}): boolean {
    return this.getMatchingMocks(path, options).some(m => m.isInvoked());
  }

  verifyCount(path: string, expectedCount: number, options: VerifyOptions = {}): boolean {
    const total = this.getMatchingMocks(path, options)
      .reduce((sum, mock) => sum + mock.callCount, 0);
    return total === expectedCount;
  }

  verifyNotCalled(path: string, options: VerifyOptions = {}): boolean {
    return this.verifyCount(path, 0, options);
  }

  explainVerification(path: string, options: VerifyOptions = {}): VerificationExplanation {
    const mocks = this.getMatchingMocks(path, options);
    const totalCallCount = mocks.reduce((sum, mock) => sum + mock.callCount, 0);

    return {
      path,
      method: options.method,
      priority: options.priority,
      id: options.id,
      matchedMocks: mocks.length,
      totalCallCount,
      mocks: mocks.map(mock => ({
        id: mock.id,
        path: mock.path,
        method: mock.method,
        priority: mock.priority,
        callCount: mock.callCount,
        isInvoked: mock.isInvoked(),
      })),
    };
  }

  private getMatchingMocks(path: string, options: VerifyOptions): MockDefinition[] {
    return this.registry.listMocks().filter((mock) => {
      if (mock.path !== path) return false;
      if (options.id && mock.id !== options.id) return false;
      if (options.method && mock.method !== options.method) return false;
      if (options.priority && mock.priority !== options.priority) return false;
      return true;
    });
  }
}
