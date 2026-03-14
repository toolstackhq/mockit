import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadConfig } from '../../src/config/config-loader.js';

describe('Config Loader', () => {
  const fixtureDir = resolve(import.meta.dirname, 'fixtures');

  it('loads mock definitions from a TypeScript config file', async () => {
    const defs = await loadConfig(`${fixtureDir}/test-config.ts`);
    expect(defs).toHaveLength(3);
  });

  it('sets default priority on loaded mocks', async () => {
    const defs = await loadConfig(`${fixtureDir}/test-config.ts`);
    expect(defs[0].priority).toBe('default');
    expect(defs[1].priority).toBe('default');
    expect(defs[2].priority).toBe('default');
  });

  it('preserves path and method', async () => {
    const defs = await loadConfig(`${fixtureDir}/test-config.ts`);
    expect(defs[0].path).toBe('/api/users');
    expect(defs[0].method).toBe('GET');
  });

  it('preserves response', async () => {
    const defs = await loadConfig(`${fixtureDir}/test-config.ts`);
    expect(defs[0].response.status).toBe(200);
    expect(defs[0].response.body).toEqual([{ id: 1, name: 'Default User' }]);
  });

  it('loads header matchers', async () => {
    const defs = await loadConfig(`${fixtureDir}/test-config.ts`);
    const def = defs[1];
    expect(def.headerMatchers.has('authorization')).toBe(true);
    expect(def.headerMatchers.get('authorization')!.match('Bearer token')).toBe(true);
  });

  it('loads cookie matchers and advanced response options', async () => {
    const defs = await loadConfig(`${fixtureDir}/test-config.ts`);
    const def = defs[2];
    expect(def.cookieMatchers.has('session_id')).toBe(true);
    expect(def.cookieMatchers.get('session_id')!.match('abc123')).toBe(true);
    expect(defs[1].response.delayRange).toEqual({ min: 10, max: 20 });
    expect(defs[1].response.template).toBe(true);
  });

  it('loads JavaScript configs with query and body matchers', async () => {
    const defs = await loadConfig(`${fixtureDir}/test-config.js`);
    const def = defs[0];

    expect(def.queryMatchers.get('page')?.match('1')).toBe(true);
    expect(def.bodyMatchers[0].jsonPath).toBe('$.role');
    expect(def.bodyMatchers[0].matcher.match('admin')).toBe(true);
  });

  it('throws for non-existent config', async () => {
    await expect(loadConfig('/nonexistent/config.ts')).rejects.toThrow();
  });

  it('rejects non-serializable custom matchers in config', async () => {
    await expect(loadConfig(`${fixtureDir}/invalid-custom-matcher-config.ts`))
      .rejects
      .toThrow(/built-in serializable matchers/i);
  });
});
