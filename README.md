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

MockIt is a REST API mocking library for JavaScript and TypeScript.

It supports three runtime patterns:

- `MockServer`: run a real mock API on a local port
- `HttpInterceptor`: intercept outbound HTTP in the current Node process
- `RemoteMockServer`: change a running `MockServer` from tests or scripts

| Feature | Use case |
| --- | --- |
| `MockServer` | Run a real mock API server for frontend development, browser automation, or any other process that needs a URL to call. |
| `HttpInterceptor` | Intercept `fetch`, `http`, `https`, and Axios inside the current Node process without starting a server. |
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

## Choose A Runtime

Use `MockServer` when:

- a browser, UI, or another process must call a real HTTP endpoint
- you want a mock to stay running outside a test process
- manual testers or QA automation need a stable fake backend

Use `HttpInterceptor` when:

- the code under test already runs in Node
- you want to fake outbound HTTP without starting a server
- your Node code uses `fetch`, Axios, `http`, or `https`

Use `RemoteMockServer` when:

- `MockServer` is already running
- the test should change mock behavior without starting the server itself

## Quick Start

Create a TypeScript config:

```bash
npx @toolstackhq/mockit init
```

In a terminal, `init` can either:
- write the default starter config
- ask a few questions and generate endpoints for you

Start a standalone mock:

```bash
npx @toolstackhq/mockit serve --config ./mockit.config.ts --port 3001
```

The dashboard is available at:

```txt
http://127.0.0.1:3001/_mockit
```

## TypeScript Config Example

```ts
import { defineConfig } from '@toolstackhq/mockit';

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

## In-Process Interceptor Example

Use `HttpInterceptor` when your code already runs in Node and you do not want to start a mock server.

```ts
import axios from 'axios';
import { HttpInterceptor } from '@toolstackhq/mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

interceptor.expect('/api/users')
  .method('GET')
  .returns(200)
  .withBody([{ id: 1, name: 'Jane Doe' }]);

interceptor.enable();

const response = await axios.get('https://api.example.com/api/users');
console.log(response.data);

interceptor.disable();
```

The request still looks like a real outbound HTTP call, but MockIt returns the response inside the same Node process.

## npm Script

```json
{
  "scripts": {
    "mockit": "mockit serve --config ./mockit.config.ts --port 3001"
  }
}
```
