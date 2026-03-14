# Features

MockIt has two primary runtimes and one remote control client:

- `MockServer`
- `HttpInterceptor`
- `RemoteMockServer`

| Feature | Use case |
| --- | --- |
| `MockServer` | Run a real mock API server for browser tests, frontend development, and shared local stacks. |
| `HttpInterceptor` | Intercept `fetch`, `http`, `https`, and Axios inside the current Node process without starting a server. |
| `RemoteMockServer` | Change a running standalone mock from a test or external script. |
| TypeScript defaults | Keep reusable default mock definitions in a typed config file. |
| OpenAPI / Swagger loading | Generate endpoints and sample responses directly from an API spec. |
| Request matching | Match method, headers, cookies, query, bearer token, and JSON body. |
| Response control | Return delays, templates, faults, sequences, and finite-use responses. |
| Dashboard and admin APIs | Inspect loaded mocks, history, unmatched requests, and pending mocks. |

## Choose The Runtime

Use `MockServer` when:

- the caller needs a real URL like `http://127.0.0.1:3001`
- a browser, UI, or another process must hit the mock
- you want the mock running outside the test process
- manual testers and QA automation need a stable fake backend

Use `HttpInterceptor` when:

- the code under test already runs in Node
- you want to fake outbound HTTP without starting a server
- the code uses `fetch`, Axios, `http`, or `https`
- you want fast unit or integration tests with no port management

Use `RemoteMockServer` when:

- `MockServer` is already running
- the test should update that running mock
- devs own the mock process, but tests still need to change responses

## Common Deployment Patterns

| Team or workflow | Recommended runtime |
| --- | --- |
| Manual QA validating a local UI | `MockServer` |
| Playwright or Cypress hitting a browser app | `MockServer` |
| Backend service tests in Node | `HttpInterceptor` |
| Axios-based SDK tests in Node | `HttpInterceptor` |
| Shared dev stack with test-time overrides | `MockServer` + `RemoteMockServer` |
| OpenAPI-first fake backend for local integration | `MockServer` |

## Shared Capabilities

All runtimes support the same core mock definition model:

- programmatic expectations
- TypeScript defaults via `loadDefaults(...)`
- OpenAPI mocks via `loadSwagger(...)`
- the same built-in matcher set

This means a matcher like `matchHeader(...)` or `matchBody(...)` works the same way whether the mock runs:

- in a standalone server
- inside a Node process
- remotely against a running standalone mock

## Configuration Sources

TypeScript defaults:

```ts
import { defineConfig } from '@toolstackhq/mockit';

export default defineConfig([
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
await runtime.loadDefaults('./mockit.config.ts');
```

OpenAPI:

```ts
await runtime.loadSwagger('./openapi.yaml');
```

## CLI

`mockit serve` starts a standalone `MockServer`.

```bash
npx @toolstackhq/mockit serve --config ./mockit.config.ts --swagger ./openapi.yaml --port 3001
```

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
