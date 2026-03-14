# MockIt

[![Build](https://img.shields.io/github/actions/workflow/status/toolstackhq/mockit/ci-build.yml?branch=main&label=build)](https://github.com/toolstackhq/mockit/actions/workflows/ci-build.yml)
[![Tests](https://img.shields.io/github/actions/workflow/status/toolstackhq/mockit/ci-tests.yml?branch=main&label=tests)](https://github.com/toolstackhq/mockit/actions/workflows/ci-tests.yml)
[![Docs](https://img.shields.io/github/actions/workflow/status/toolstackhq/mockit/docs-pages.yml?branch=main&label=docs)](https://github.com/toolstackhq/mockit/actions/workflows/docs-pages.yml)
[![Coverage](https://codecov.io/gh/toolstackhq/mockit/branch/main/graph/badge.svg)](https://codecov.io/gh/toolstackhq/mockit)
[![License](https://img.shields.io/github/license/toolstackhq/mockit)](./LICENSE)
[![npm](https://img.shields.io/npm/v/%40toolstackhq%2Fmockit?label=npm)](https://www.npmjs.com/package/@toolstackhq/mockit)
[![npm downloads](https://img.shields.io/npm/dm/%40toolstackhq%2Fmockit)](https://www.npmjs.com/package/@toolstackhq/mockit)
[![Release](https://img.shields.io/github/v/release/toolstackhq/mockit?sort=semver)](https://github.com/toolstackhq/mockit/releases)
[![Last Commit](https://img.shields.io/github/last-commit/toolstackhq/mockit)](https://github.com/toolstackhq/mockit/commits/main)

MockIt is a TypeScript REST API mocking library for local development and testing.

| Feature | Use case |
| --- | --- |
| `MockServer` | Run a real mock API server for frontend dev, browser automation, or cross-process testing. |
| `HttpInterceptor` | Intercept `fetch` in the current Node process for unit and integration tests. |
| `RemoteMockServer` | Update a running standalone mock from Playwright, API tests, or external scripts. |
| TypeScript defaults | Load reusable default mocks from a typed config file. |
| OpenAPI / Swagger loading | Generate mock endpoints and sample responses from an API spec. |
| Request matching | Match by method, headers, cookies, query, bearer token, and body. |
| Response control | Return delays, templates, faults, sequences, and limited-use responses. |
| Dashboard and admin APIs | Inspect mocks, requests, unmatched calls, and pending expectations. |

Live docs: https://toolstackhq.github.io/mockit/

Install:

```bash
npm install @toolstackhq/mockit
```

Create a TypeScript config:

```bash
npx @toolstackhq/mockit init
```

In a terminal, `init` can either:
- write the default starter config
- ask a few questions and generate endpoints for you

Simple TypeScript usage:

```ts
import { MockServer, defineConfig } from '@toolstackhq/mockit';

export default defineConfig([
  {
    path: '/api/balance',
    method: 'GET',
    response: {
      status: 200,
      body: { balance: 200, currency: 'AUD' },
    },
  },
]);
```

```ts
import { MockServer } from '@toolstackhq/mockit';

const server = new MockServer({ port: 3001 });
await server.loadDefaults('./mockit.config.ts');

await server.start();

console.log(server.address); // http://127.0.0.1:3001
```

Dashboard:

```txt
http://127.0.0.1:3001/_mockit
```

Run a standalone mock from a project script:

```json
{
  "scripts": {
    "mockit": "mockit serve --config ./mockit.config.ts --port 3001"
  }
}
```
