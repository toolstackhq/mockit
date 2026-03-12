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

export function schemaToMockValue(schema: SchemaObject, propertyName?: string): any {
  if (schema.example !== undefined) return schema.example;

  switch (schema.type) {
    case 'string':
      return generateString(schema, propertyName);
    case 'number':
    case 'integer':
      return generateNumber(schema);
    case 'boolean':
      return true;
    case 'array':
      return generateArray(schema, propertyName);
    case 'object':
      return generateObject(schema);
    default:
      return null;
  }
}

function generateString(schema: SchemaObject, propertyName?: string): string {
  if (schema.enum && schema.enum.length > 0) return String(schema.enum[0]);

  switch (schema.format) {
    case 'date': return '2024-01-15';
    case 'date-time': return '2024-01-15T10:30:00Z';
    case 'email': return 'user@example.com';
    case 'uuid': return '550e8400-e29b-41d4-a716-446655440000';
    case 'uri': return 'https://example.com';
    default: return generateNamedString(propertyName);
  }
}

function generateNumber(schema: SchemaObject): number {
  if (schema.minimum !== undefined) return schema.minimum;
  if (schema.maximum !== undefined) return schema.maximum;
  return schema.type === 'integer' ? 1 : 1.0;
}

function generateArray(schema: SchemaObject, propertyName?: string): any[] {
  if (!schema.items) return [];
  return [schemaToMockValue(schema.items, singularize(propertyName))];
}

function generateObject(schema: SchemaObject): Record<string, any> {
  const result: Record<string, any> = {};
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      result[key] = schemaToMockValue(prop, key);
    }
  }
  return result;
}

function generateNamedString(propertyName?: string): string {
  const rawKey = propertyName || '';
  const key = rawKey.toLowerCase();

  if (!key) return 'sample-string';
  if (key === 'name') return 'Sample Name';
  if (key === 'title') return 'Sample Title';
  if (key === 'description') return 'Sample description';
  if (key === 'tag' || key.endsWith('tag')) return 'default-tag';
  if (key === 'status') return 'active';
  if (key === 'type') return 'default';
  if (key === 'message') return 'ok';
  if (key === 'currency' || key.endsWith('currency')) return 'USD';
  if (key === 'country' || key.endsWith('country')) return 'Australia';
  if (key === 'city' || key.endsWith('city')) return 'Sydney';
  if (key === 'state' || key.endsWith('state')) return 'NSW';
  if (key === 'postcode' || key === 'postalcode' || key.endsWith('postcode')) return '2000';
  if (key === 'firstname' || key.endsWith('firstname')) return 'Jane';
  if (key === 'lastname' || key.endsWith('lastname')) return 'Doe';
  if (key === 'username' || key.endsWith('username')) return 'jane.doe';
  if (key === 'email' || key.endsWith('email')) return 'user@example.com';
  if (key === 'phone' || key.endsWith('phone')) return '+1-555-0100';
  if (key === 'url' || key.endsWith('url')) return 'https://example.com';

  return `sample-${toKebabCase(rawKey)}`;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function singularize(value?: string): string | undefined {
  if (!value) return value;
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('s')) return value.slice(0, -1);
  return value;
}
