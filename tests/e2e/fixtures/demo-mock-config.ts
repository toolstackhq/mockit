import { defineDefaults } from '../../../src/config/types.js';

export default defineDefaults([
  {
    path: '/api/balance',
    method: 'GET',
    response: {
      status: 200,
      body: {
        balance: 200,
        currency: 'AUD',
      },
    },
  },
  {
    path: '/api/login',
    method: 'POST',
    response: {
      status: 200,
      body: {
        message: 'logged in',
      },
    },
  },
]);
