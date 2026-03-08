import type { HttpMethod } from '../core/types.js';
import { MockDefinition } from '../core/mock-definition.js';
import { parseSwaggerSpec } from './swagger-loader.js';
import { schemaToMockValue } from './schema-to-mock.js';

export async function loadSwaggerMocks(source: string): Promise<MockDefinition[]> {
  const endpoints = await parseSwaggerSpec(source);
  const definitions: MockDefinition[] = [];

  for (const endpoint of endpoints) {
    // Prefer 200 or 201 response, fallback to first success status
    const successStatus = findSuccessStatus(endpoint.responses);
    if (!successStatus) continue;

    const schema = endpoint.responses.get(successStatus);
    const body = schema ? schemaToMockValue(schema) : null;

    const def = new MockDefinition(endpoint.path, 'swagger');
    def.method = endpoint.method as HttpMethod;
    def.response = {
      status: parseInt(successStatus, 10),
      headers: { 'Content-Type': 'application/json' },
      body,
    };

    definitions.push(def);
  }

  return definitions;
}

function findSuccessStatus(responses: Map<string, any>): string | undefined {
  for (const status of ['200', '201', '202', '204']) {
    if (responses.has(status)) return status;
  }
  // Fallback to any 2xx
  for (const status of responses.keys()) {
    if (status.startsWith('2')) return status;
  }
  // Fallback to first status
  const first = responses.keys().next();
  return first.done ? undefined : first.value;
}
