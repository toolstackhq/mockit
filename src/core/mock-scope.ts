import { MockRegistry } from './mock-registry.js';
import { ExpectBuilder } from '../builder/expect-builder.js';
import type { MockDefinition } from './mock-definition.js';

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
}
