# MockIt

MockIt is a TypeScript REST API mocking library for local development and testing.

It gives teams two ways to mock dependencies:

- `MockServer`: run a standalone HTTP mock server
- `HttpInterceptor`: intercept `fetch` inside the current test process

They are different runtimes, not two names for the same feature:

- use `MockServer` when the app/browser/process must call a real HTTP endpoint
- use `HttpInterceptor` when the code under test runs in the same Node process and uses `fetch`

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
- lifecycle controls with `count(n)`, `once()`, `times(n)`, `persist()`, `optionally()`, and sequential replies
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

- [Installation docs](./docs/guide/installation.md)
- [Usage docs](./docs/guide/usage.md)
- [Examples](./examples)
