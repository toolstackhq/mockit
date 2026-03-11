# HttpInterceptor

## What It Is

`HttpInterceptor` does not start a server. It patches `fetch` inside the current Node process.

Best for:

- Vitest or Jest service tests
- Node-side integration tests
- component tests that run in Node

## Features

- uses the same `expect(...).returns(...)` API as `MockServer`
- supports defaults and OpenAPI loading
- supports `passthrough`, `fail`, and `proxy` modes for unmatched requests
- records matched and unmatched requests in the same journal APIs

## Configure

TypeScript defaults:

```ts
await interceptor.loadDefaults('./mock-config.ts');
```

OpenAPI:

```ts
await interceptor.loadSwagger('./openapi.yaml');
```

## Usage

```ts
import { HttpInterceptor } from '@toolstackhq/mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

interceptor.expect('/api/users')
  .method('GET')
  .returns(200)
  .withBody([{ id: 1, name: 'Intercepted User' }]);

interceptor.enable();

const res = await fetch('http://localhost/api/users');
console.log(await res.json());

interceptor.disable();
```

## Available Expectations

The expectation and response APIs are the same as `MockServer`.

Common methods:

- `method(...)`
- `count(n)`
- `matchHeader(...)`
- `matchCookie(...)`
- `matchBearerToken(...)`
- `matchQuery(...)`
- `matchBody(...)`
- `matchBodyEquals(...)`
- `returns(...)`
- `withBody(...)`
- `withHeaders(...)`
- `withDelay(...)`
- `withRandomDelay(...)`
- `withBodyTemplate(...)`
- `withFault(...)`
- `thenReply(...)`
- `replySequence(...)`

## Notes

- `HttpInterceptor` works only inside the current Node process
- it intercepts `fetch`, not arbitrary browser traffic
- use `onUnhandled: 'fail'` for strict tests
- use `MockServer` instead if a browser or another process must hit the mock
- it is not a standalone process runtime

## Sample

```ts
import { HttpInterceptor } from '@toolstackhq/mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

interceptor.enable();

interceptor.expect('/api/profile')
  .method('GET')
  .returns(500)
  .withBody({ retry: true })
  .thenReply(200)
  .withBody({ id: 1, name: 'Jane' });

// app code calls fetch('/api/profile')

interceptor.disable();
```
