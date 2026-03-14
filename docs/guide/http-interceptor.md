# HttpInterceptor

## What It Is

`HttpInterceptor` does not start a server.

It intercepts outbound HTTP calls inside the current Node process and returns mocked responses before those calls leave the process.

Use it when:

- the code under test already runs in Node
- you do not want to manage a mock server port
- you want to mock Axios, `fetch`, `http`, or `https` without changing the code to point to a different base URL

Simple mental model:

- your code tries to call a real API
- MockIt catches that call inside the process
- if the request matches a mock, MockIt returns the fake response
- the real network call does not happen

## What It Intercepts

MockIt patches these Node APIs:

```ts
globalThis.fetch
http.request
https.request
```

That covers common Node-side clients such as:

- `fetch`
- Axios in Node
- libraries built on Node `http` or `https`

Example:

```ts
await fetch('https://api.example.com/users');
await axios.get('https://api.example.com/users');
```

After `interceptor.enable()`, MockIt temporarily replaces those request functions with its own wrappers.

## When To Use It

Use `HttpInterceptor` for:

- backend service tests
- SDK or API client tests in Node
- retry, timeout, and error-path testing
- Node integration tests that call real-looking external URLs

Do not use it for:

- browser traffic from a real Playwright or Cypress page
- local frontend development where the app needs a real API URL
- cross-process testing

For those cases, use `MockServer`.

## Features

- uses the same `expect(...).returns(...)` API as `MockServer`
- supports defaults and OpenAPI loading
- supports `passthrough`, `fail`, and `proxy` modes for unmatched requests
- records matched and unmatched requests in the same journal APIs
- matches by request path, not by base URL or hostname
- covers Node clients built on `http` / `https`, including Axios in Node

## Why Not Just Use MockServer

`MockServer` is the right choice when the caller needs a real URL.

`HttpInterceptor` is the right choice when the caller is already running in the same Node process.

Example:

- browser test hitting a local app: use `MockServer`
- service test calling `axios.get('https://payments.internal/users')`: use `HttpInterceptor`

The benefit is that your application code can keep using the real outbound URL shape in tests.

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
import axios from 'axios';
import { HttpInterceptor } from '@toolstackhq/mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

interceptor.expect('/api/users')
  .method('GET')
  .returns(200)
  .withBody([{ id: 1, name: 'Intercepted User' }]);

interceptor.enable();

const res = await axios.get('https://api.example.com/api/users');
console.log(res.data);

interceptor.disable();
```

## How Matching Works

`HttpInterceptor` currently matches by path and method.

That means this expectation:

```ts
interceptor.expect('/users').method('GET');
```

can match all of these:

```ts
await fetch('http://localhost/users');
await fetch('https://api.example.com/users');
await fetch('https://google.com/users');
```

because the request path is still `/users`.

So:

- base URL does not matter
- path does matter
- extra matchers like headers, query, cookies, and body still apply if you add them

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

Built-in matchers:

- `equals(...)`
- `startsWith(...)`
- `endsWith(...)`
- `contains(...)`
- `regex(...)`
- `greaterThan(...)`
- `lessThan(...)`
- `between(...)`
- `any()`

## Notes

- `HttpInterceptor` works only inside the current Node process
- it intercepts `fetch`, `http`, and `https` in Node
- that means Axios in Node is intercepted too
- it does not intercept arbitrary browser traffic from a real page
- use `onUnhandled: 'fail'` for strict tests
- use `MockServer` instead if a browser or another process must hit the mock
- it is not a standalone process runtime

## Sample

```ts
import axios from 'axios';
import { HttpInterceptor } from '@toolstackhq/mockit';

const interceptor = new HttpInterceptor({ onUnhandled: 'fail' });

interceptor.enable();

interceptor.expect('/api/profile')
  .method('GET')
  .returns(500)
  .withBody({ retry: true })
  .thenReply(200)
  .withBody({ id: 1, name: 'Jane' });

const response = await axios.get('https://users.internal/api/profile');
console.log(response.data);

interceptor.disable();
```
