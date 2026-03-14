import { defineConfig, equals } from '../../../src/index.js';

export default defineConfig([
  {
    path: '/api/filter',
    method: 'POST',
    matchers: {
      query: {
        page: equals('1'),
      },
      body: [
        {
          jsonPath: '$.role',
          matcher: equals('admin'),
        },
      ],
    },
    response: {
      status: 200,
      body: { ok: true },
    },
  },
]);
