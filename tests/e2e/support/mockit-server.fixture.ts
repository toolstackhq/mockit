import { test as base } from '@playwright/test';
import { MockServer, RemoteMockServer } from '../../../src/index.js';

type Fixtures = {
  mockServer: MockServer;
  remoteMock: RemoteMockServer;
};

export const test = base.extend<Fixtures>({
  mockServer: async ({}, use) => {
    const server = new MockServer({ port: 0 });
    await server.loadDefaults(new URL('../../config/fixtures/test-config.ts', import.meta.url).pathname);
    await server.loadSwagger(new URL('../../swagger/fixtures/petstore.yaml', import.meta.url).pathname);
    await server.start();

    try {
      await use(server);
    } finally {
      await server.stop();
    }
  },

  remoteMock: async ({ mockServer }, use) => {
    const remote = new RemoteMockServer(mockServer.address);
    await use(remote);
  },
});

test.afterEach(async ({ remoteMock }) => {
  await remoteMock.resetOverrides();
  await remoteMock.clearHistory();
});
