import { defineDefaults } from '../../../src/config/types.js';
import { startsWith } from '../../../src/matchers/string-matchers.js';

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
    },
  },
]);
