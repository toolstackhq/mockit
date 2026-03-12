import { test as base } from '@playwright/test';
import { MockServer, RemoteMockServer } from '../../../src/index.js';
import { startDemoAppServer, type DemoAppServer } from './demo-app-server.js';

type Fixtures = {
  mockServer: MockServer;
  remoteMock: RemoteMockServer;
  appServer: DemoAppServer;
  appUrl: string;
};

export const test = base.extend<Fixtures>({
  mockServer: async ({}, use) => {
    const server = new MockServer({ port: 0 });
    const configPath = new URL('../fixtures/demo-mock-config.ts', import.meta.url).pathname;
    await server.loadDefaults(configPath);
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

  appServer: async ({ mockServer }, use) => {
    const app = await startDemoAppServer(mockServer.address);
    try {
      await use(app);
    } finally {
      await app.stop();
    }
  },

  appUrl: async ({ appServer }, use) => {
    await use(appServer.url);
  },
});

test.afterEach(async ({ remoteMock }) => {
  await remoteMock.resetOverrides();
  await remoteMock.clearJournal();
});
