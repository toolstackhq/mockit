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

It supports two runtimes:

- `MockServer` for a real HTTP mock server
- `HttpInterceptor` for in-process `fetch` interception in Node tests

Live docs: https://toolstackhq.github.io/mockit/

Install:

```bash
npm install @toolstackhq/mockit
```

Simple TypeScript usage:

```ts
import { MockServer } from '@toolstackhq/mockit';

const server = new MockServer({ port: 3001 });

server.expect('/api/balance')
  .method('GET')
  .count(0)
  .returns(200)
  .withBody({ balance: 200, currency: 'AUD' });

await server.start();

console.log(server.address); // http://127.0.0.1:3001
```

Run a standalone mock from a project script:

```json
{
  "scripts": {
    "mockit": "mockit serve --config ./mock-config.ts --port 3001"
  }
}
```
