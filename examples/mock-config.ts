import { defineDefaults, startsWith } from '../src/index.js';

export default defineDefaults([
  {
    path: '/api/users',
    method: 'GET',
    response: {
      status: 200,
      body: [
        { id: 1, name: 'Alice Johnson', email: 'alice@bank.com' },
        { id: 2, name: 'Bob Smith', email: 'bob@bank.com' },
      ],
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
      body: { id: 1, name: 'Alice Johnson', email: 'alice@bank.com' },
    },
  },
  {
    path: '/api/accounts',
    method: 'GET',
    response: {
      status: 200,
      body: [
        { id: 'ACC001', balance: 5000.0, currency: 'USD' },
        { id: 'ACC002', balance: 12500.5, currency: 'EUR' },
      ],
    },
  },
]);
