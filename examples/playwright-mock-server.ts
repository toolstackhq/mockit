import { test as base, expect } from '@playwright/test';
import { MockServer } from '../src/index.js';

type Fixtures = {
  mockServer: MockServer;
};

export const test = base.extend<Fixtures>({
  mockServer: async ({}, use) => {
    const server = new MockServer({ port: 3001 });
    await server.start();

    try {
      await use(server);
    } finally {
      await server.stop();
    }
  },
});

test.afterEach(async ({ mockServer }) => {
  mockServer.resetOverrides();
  mockServer.clearJournal();
});

test('shows retry state before success', async ({ page, mockServer }) => {
  mockServer.expect('/api/orders/123/status')
    .method('GET')
    .returns(202)
    .withBody({ status: 'processing' })
    .thenReply(200)
    .withBody({ status: 'complete' });

  await page.goto('http://localhost:5173/orders/123');

  await expect(page.getByText('processing')).toBeVisible();
  await expect(page.getByText('complete')).toBeVisible();

  expect(mockServer.listRequests()).toHaveLength(2);
});

test('captures an unmatched request in the journal', async ({ page, mockServer }) => {
  await page.goto('http://localhost:5173');

  const unmatched = mockServer.listUnmatchedRequests();
  console.log('Unmatched requests:', unmatched);
});
