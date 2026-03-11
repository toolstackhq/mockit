# Features

MockIt has two major features:

- `MockServer`
- `HttpInterceptor`

Both support the same mock definition style:

- programmatic expectations
- TypeScript defaults via `loadDefaults(...)`
- OpenAPI mocks via `loadSwagger(...)`

## Configuration Sources

TypeScript defaults:

```ts
import { defineDefaults } from 'mockit';

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

Use `HttpInterceptor` when:

- the code under test already runs in Node
- the code uses `fetch`
- you want a lighter setup without a server port

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
