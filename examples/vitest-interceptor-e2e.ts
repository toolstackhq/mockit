import { afterEach, beforeEach, expect, it } from 'vitest';
import { HttpInterceptor } from '../src/index.js';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

beforeEach(() => {
  interceptor.enable();
});

afterEach(() => {
  interceptor.disable();
  interceptor.resetAll();
  interceptor.clearJournal();
});

it('retries once and then succeeds', async () => {
  interceptor.expect('/api/profile')
    .method('GET')
    .returns(500)
    .withBody({ retry: true })
    .thenReply(200)
    .withBody({ id: 1, name: 'Jane' });

  // Replace these with the real app/API call in your project.
  const first = await fetch('http://localhost/api/profile');
  const second = await fetch('http://localhost/api/profile');

  expect(first.status).toBe(500);
  expect(second.status).toBe(200);
  expect(interceptor.listRequests()).toHaveLength(2);
});
