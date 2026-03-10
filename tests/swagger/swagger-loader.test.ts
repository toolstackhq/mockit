import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { parseSwaggerSpec } from '../../src/swagger/swagger-loader.js';
import { loadSwaggerMocks } from '../../src/swagger/swagger-registry.js';
import { schemaToMockValue } from '../../src/swagger/schema-to-mock.js';

describe('Swagger Loader', () => {
  const specPath = resolve(import.meta.dirname, 'fixtures/petstore.yaml');

  describe('parseSwaggerSpec', () => {
    it('parses endpoints from OpenAPI spec', async () => {
      const endpoints = await parseSwaggerSpec(specPath);
      expect(endpoints.length).toBeGreaterThanOrEqual(3);
    });

    it('converts path params from {id} to :id format', async () => {
      const endpoints = await parseSwaggerSpec(specPath);
      const petById = endpoints.find(e => e.path.includes(':petId'));
      expect(petById).toBeDefined();
      expect(petById!.path).toBe('/pets/:petId');
    });

    it('preserves operation methods', async () => {
      const endpoints = await parseSwaggerSpec(specPath);
      const methods = endpoints.map(e => e.method);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
    });
  });

  describe('loadSwaggerMocks', () => {
    it('creates mock definitions from swagger spec', async () => {
      const defs = await loadSwaggerMocks(specPath);
      expect(defs.length).toBeGreaterThanOrEqual(3);
    });

    it('sets swagger priority', async () => {
      const defs = await loadSwaggerMocks(specPath);
      for (const def of defs) {
        expect(def.priority).toBe('swagger');
      }
    });

    it('generates response bodies from schema examples', async () => {
      const defs = await loadSwaggerMocks(specPath);
      const listPets = defs.find(d => d.path === '/pets' && d.method === 'GET');
      expect(listPets).toBeDefined();
      expect(listPets!.response.body).toEqual([{ id: 1, name: 'Buddy', tag: 'string' }]);
    });

    it('sets correct status codes', async () => {
      const defs = await loadSwaggerMocks(specPath);
      const createPet = defs.find(d => d.path === '/pets' && d.method === 'POST');
      expect(createPet).toBeDefined();
      expect(createPet!.response.status).toBe(201);
    });

    it('falls back to the first available status when no success status exists', async () => {
      const fallbackSpecPath = resolve(import.meta.dirname, 'fixtures/fallback-status.yaml');
      const defs = await loadSwaggerMocks(fallbackSpecPath);
      expect(defs[0].response.status).toBe(418);
    });
  });

  describe('schemaToMockValue', () => {
    it('uses example when provided', () => {
      expect(schemaToMockValue({ type: 'string', example: 'hello' })).toBe('hello');
    });

    it('generates string default', () => {
      expect(schemaToMockValue({ type: 'string' })).toBe('string');
    });

    it('generates email format', () => {
      expect(schemaToMockValue({ type: 'string', format: 'email' })).toBe('user@example.com');
    });

    it('generates integer', () => {
      expect(schemaToMockValue({ type: 'integer' })).toBe(1);
    });

    it('generates boolean', () => {
      expect(schemaToMockValue({ type: 'boolean' })).toBe(true);
    });

    it('generates array', () => {
      const result = schemaToMockValue({
        type: 'array',
        items: { type: 'string' },
      });
      expect(result).toEqual(['string']);
    });

    it('generates object', () => {
      const result = schemaToMockValue({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
        },
      });
      expect(result).toEqual({ name: 'string', age: 1 });
    });

    it('uses enum first value', () => {
      expect(schemaToMockValue({ type: 'string', enum: ['active', 'inactive'] })).toBe('active');
    });

    it('generates additional string formats', () => {
      expect(schemaToMockValue({ type: 'string', format: 'date' })).toBe('2024-01-15');
      expect(schemaToMockValue({ type: 'string', format: 'date-time' })).toBe('2024-01-15T10:30:00Z');
      expect(schemaToMockValue({ type: 'string', format: 'uuid' })).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(schemaToMockValue({ type: 'string', format: 'uri' })).toBe('https://example.com');
    });

    it('uses numeric bounds and null fallbacks', () => {
      expect(schemaToMockValue({ type: 'number', minimum: 3 })).toBe(3);
      expect(schemaToMockValue({ type: 'number', maximum: 9 })).toBe(9);
      expect(schemaToMockValue({ type: 'array' })).toEqual([]);
      expect(schemaToMockValue({})).toBeNull();
    });
  });
});
