import { describe, expect, it } from 'vitest';
import { defineConfig, defineDefaults } from '../../src/config/types.js';

describe('config type helpers', () => {
  it('return the provided config arrays unchanged', () => {
    const configs = [
      {
        path: '/api/users',
        method: 'GET' as const,
        response: {
          status: 200,
          body: [{ id: 1 }],
        },
      },
    ];

    expect(defineConfig(configs)).toBe(configs);
    expect(defineDefaults(configs)).toBe(configs);
  });
});
