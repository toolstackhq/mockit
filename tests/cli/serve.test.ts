import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { buildDashboardUrl, helpText, parseServeArgs } from '../../src/cli/serve.js';

describe('CLI serve parser', () => {
  it('parses positional config paths', () => {
    const options = parseServeArgs(['./mock-config.ts']);
    expect(options.configPath).toBe(resolve('./mock-config.ts'));
    expect(options.swaggerPath).toBeUndefined();
    expect(options.port).toBe(3001);
    expect(options.host).toBe('127.0.0.1');
  });

  it('parses named flags', () => {
    const options = parseServeArgs([
      '--config', './mock-config.ts',
      '--swagger', './openapi.yaml',
      '--port', '4010',
      '--host', '0.0.0.0',
    ]);

    expect(options.configPath).toBe(resolve('./mock-config.ts'));
    expect(options.swaggerPath).toBe(resolve('./openapi.yaml'));
    expect(options.port).toBe(4010);
    expect(options.host).toBe('0.0.0.0');
  });

  it('supports swagger-only startup', () => {
    const options = parseServeArgs(['--swagger', './openapi.yaml']);
    expect(options.configPath).toBeUndefined();
    expect(options.swaggerPath).toBe(resolve('./openapi.yaml'));
  });

  it('rejects invalid ports and unknown args', () => {
    expect(() => parseServeArgs(['--port', 'abc'])).toThrow(/Invalid port/i);
    expect(() => parseServeArgs(['--wat'])).toThrow(/Unknown argument/i);
    expect(() => parseServeArgs(['--config'])).toThrow(/Missing value/i);
  });

  it('returns help text', () => {
    expect(helpText()).toContain('mockit serve');
    expect(helpText()).toContain('--swagger');
  });

  it('builds a dashboard url for local access', () => {
    expect(buildDashboardUrl('127.0.0.1', 3001)).toBe('http://127.0.0.1:3001/_mockit');
    expect(buildDashboardUrl('0.0.0.0', 3001)).toBe('http://127.0.0.1:3001/_mockit');
  });
});
