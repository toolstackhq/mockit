# Features

MockIt has two major features:

- `MockServer`
- `HttpInterceptor`

`MockServer` can also be controlled remotely with `RemoteMockServer` when the mock is already running as a separate process.

## Ways To Run MockIt

In-memory mock:

- use `HttpInterceptor`
- runs inside the same Node process as the test or app code
- good for service tests and Node-side integration tests

Standalone mock:

- use `MockServer`
- runs as a real HTTP server
- good for frontend development, browser automation, and cross-process testing

Remote updates for a standalone mock:

- use `RemoteMockServer`
- lets tests change a running `MockServer` without owning its in-memory instance
- good when devs keep the mock server up and automation changes behavior per test

Both support the same mock definition style:

- programmatic expectations
- TypeScript defaults via `loadDefaults(...)`
- OpenAPI mocks via `loadSwagger(...)`
- the same built-in matcher set

CLI support:

```bash
mockit serve --config ./mock-config.ts --swagger ./openapi.yaml --port 3001
```

That CLI runs `MockServer` as a standalone process.

## Configuration Sources

TypeScript defaults:

```ts
import { defineDefaults } from '@toolstackhq/mockit';

export default defineDefaults([
  {
    path: '/api/users',
    method: 'GET',
    response: {
      status: 200,
      body: [{ id: 1, name: 'Default User' }],
    },
  },
]);
```

```ts
await runtime.loadDefaults('./mock-config.ts');
```

OpenAPI:

```ts
await runtime.loadSwagger('./openapi.yaml');
```

## Which One Should I Use?

Use `MockServer` when:

- you need a real HTTP endpoint
- the browser must call the mock
- another process must call the mock
- you want a standalone mock that can stay running outside the test process

Use `HttpInterceptor` when:

- the code under test already runs in Node
- the code uses `fetch`
- you want a lighter setup without a server port

Use `RemoteMockServer` when:

- `MockServer` is already running
- the test should update that running mock
- the test does not own the in-memory `MockServer` instance

## Expectation Style

The common flow is:

```ts
runtime.expect('/api/users')
  .method('GET')
  .count(1)
  .returns(200)
  .withBody([{ id: 1, name: 'Jane' }]);
```

For full details, see:

- `/guide/mock-server`
- `/guide/http-interceptor`
