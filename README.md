# MockIt

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
