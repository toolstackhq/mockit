import SwaggerParser from '@apidevtools/swagger-parser';
import type { SchemaObject } from './schema-to-mock.js';

export interface ParsedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  responses: Map<string, SchemaObject | null>;
}

export async function parseSwaggerSpec(source: string): Promise<ParsedEndpoint[]> {
  const api = await SwaggerParser.dereference(source) as any;
  const endpoints: ParsedEndpoint[] = [];

  if (!api.paths) return endpoints;

  for (const [path, pathItem] of Object.entries(api.paths)) {
    if (!pathItem) continue;

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

    for (const method of methods) {
      const operation = (pathItem as any)[method];
      if (!operation?.responses) continue;

      const responses = new Map<string, SchemaObject | null>();

      for (const [statusCode, response] of Object.entries(operation.responses)) {
        const responseObj = response as any;
        const content = responseObj.content;
        const jsonContent = content?.['application/json'];

        if (jsonContent?.schema) {
          responses.set(statusCode, jsonContent.schema as SchemaObject);
        } else {
          responses.set(statusCode, null);
        }
      }

      // Convert OpenAPI path params {id} to :id format
      const normalizedPath = path.replace(/\{(\w+)\}/g, ':$1');

      endpoints.push({
        path: normalizedPath,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        responses,
      });
    }
  }

  return endpoints;
}
