import { defineDefaults } from '../../../src/config/types.js';
import { equals, startsWith } from '../../../src/matchers/string-matchers.js';

export default defineDefaults([
  {
    path: '/api/users',
    method: 'GET',
    response: {
      status: 200,
      body: [{ id: 1, name: 'Default User' }],
    },
  },
  {
    path: '/api/users/:id',
    method: 'GET',
    matchers: {
      headers: { Authorization: startsWith('Bearer') },
    },
    response: {
      status: 200,
      body: { id: 1, name: 'Default User' },
      delayRange: { min: 10, max: 20 },
      template: true,
    },
  },
  {
    path: '/api/cookie-protected',
    method: 'GET',
    matchers: {
      cookies: { session_id: equals('abc123') },
    },
    response: {
      status: 200,
      body: { ok: true },
    },
  },
]);
