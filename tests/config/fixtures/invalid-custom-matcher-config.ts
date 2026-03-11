import { defineDefaults } from '../../../src/config/types.js';

export default defineDefaults([
  {
    path: '/api/users',
    method: 'GET',
    matchers: {
      headers: {
        Authorization: {
          name: 'customMatcher()',
          match: (value: string) => value.startsWith('Bearer '),
        } as any,
      },
    },
    response: {
      status: 200,
      body: { ok: true },
    },
  },
]);
