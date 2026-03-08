export interface SchemaObject {
  type?: string;
  format?: string;
  example?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
}

export function schemaToMockValue(schema: SchemaObject): any {
  if (schema.example !== undefined) return schema.example;

  switch (schema.type) {
    case 'string':
      return generateString(schema);
    case 'number':
    case 'integer':
      return generateNumber(schema);
    case 'boolean':
      return true;
    case 'array':
      return generateArray(schema);
    case 'object':
      return generateObject(schema);
    default:
      return null;
  }
}

function generateString(schema: SchemaObject): string {
  if (schema.enum && schema.enum.length > 0) return String(schema.enum[0]);

  switch (schema.format) {
    case 'date': return '2024-01-15';
    case 'date-time': return '2024-01-15T10:30:00Z';
    case 'email': return 'user@example.com';
    case 'uuid': return '550e8400-e29b-41d4-a716-446655440000';
    case 'uri': return 'https://example.com';
    default: return 'string';
  }
}

function generateNumber(schema: SchemaObject): number {
  if (schema.minimum !== undefined) return schema.minimum;
  if (schema.maximum !== undefined) return schema.maximum;
  return schema.type === 'integer' ? 1 : 1.0;
}

function generateArray(schema: SchemaObject): any[] {
  if (!schema.items) return [];
  return [schemaToMockValue(schema.items)];
}

function generateObject(schema: SchemaObject): Record<string, any> {
  const result: Record<string, any> = {};
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      result[key] = schemaToMockValue(prop);
    }
  }
  return result;
}
