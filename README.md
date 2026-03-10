# MockIt

MockIt is a TypeScript REST API mocking library for local development and testing.

It gives teams two ways to mock dependencies:

- `MockServer`: run a standalone HTTP mock server
- `HttpInterceptor`: intercept `fetch` inside the current test process

Mocks can come from:

- programmatic overrides
- shared TypeScript config files
- OpenAPI-generated baseline mocks

## What It Is Useful For

- frontend development before backend APIs are ready
- backend integration tests without starting real downstream services
- QA and E2E testing with deterministic API behavior
- team workflows where shared default mocks are overridden per test
- retry, timeout, and error-state testing with delays and simulated faults

## Core Ideas

- override-first resolution: `override > default > swagger`
- request matching by path, method, headers, cookies, query, and JSON body
- response shaping with body, headers, delay, random delay, templates, and faults
- lifecycle controls with `once()`, `times(n)`, `persist()`, `optionally()`, and sequential replies
- request journal APIs for matched, unmatched, pending, and proxied traffic
- proxy/record mode for capturing upstream responses as reusable mocks
- verification helpers to assert which mocks were called and how many times

## Quick Example

```ts
import { MockServer, equals } from 'mockit';

const server = new MockServer({ port: 3001 });

server.expect('/api/login')
  .method('POST')
  .matchBody('$.email', equals('user@example.com'))
  .returns(200)
  .withBody({ token: 'test-token' });

await server.start();
console.log(server.address);
```

## Team Use Cases

- Developers use shared baseline mocks during feature work.
- Test authors override only the endpoint needed for a scenario.
- QA runs stable UI and API flows without depending on flaky environments.
- CI uses deterministic mocks and verifies dependency calls explicitly.

## Docs

- [Usage docs](./docs/guide/usage.md)
- [Installation docs](./docs/guide/installation.md)
- [MVP feature guide](./docs/guide/mvp-features.md)
- [E2E recipes](./docs/guide/e2e-playwright.md)
- [Examples](./examples)
