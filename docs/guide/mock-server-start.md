# MockServer Start

`MockServer` can be started in test code or as a standalone process.

## Start From Code

```ts
import { MockServer } from '@toolstackhq/mockit';

const server = new MockServer({ port: 3001 });
await server.start();

console.log(server.address); // http://127.0.0.1:3001
```

Your app must call the mock server address.

```ts
const res = await fetch('http://127.0.0.1:3001/api/users');
```

## Start Standalone From CLI

```bash
mockit serve --config ./mock-config.ts --swagger ./openapi.yaml --port 3001 --host 127.0.0.1
```

This starts the same `MockServer` runtime as a standalone process.

Dashboard:

```txt
http://127.0.0.1:3001/_mockit
```

Admin APIs:

- `http://127.0.0.1:3001/_mockit/api/mocks`
- `http://127.0.0.1:3001/_mockit/api/requests`
- `http://127.0.0.1:3001/_mockit/api/unmatched`
- `http://127.0.0.1:3001/_mockit/api/pending`
- `http://127.0.0.1:3001/_mockit/api/history`

## Update A Running Standalone Mock

If the standalone mock is already running, tests can update it with `RemoteMockServer`:

```ts
import { RemoteMockServer } from '@toolstackhq/mockit';

const remote = new RemoteMockServer('http://127.0.0.1:3001');

await remote.expect('/api/login')
  .method('POST')
  .count(1)
  .returns(403)
  .withBody({ message: 'unauthorized' })
  .apply();
```

## Why Use Standalone

- keep the mock running with the app during local development
- let Playwright or Cypress hit a real mock server
- let tests override behavior without starting the server themselves
- give QA or manual testers a stable fake backend even outside automated tests

## npm Script

If a project installs `@toolstackhq/mockit`, it can expose the CLI through an npm script:

```json
{
  "scripts": {
    "mockit": "mockit serve --config ./mock-config.ts --port 3001"
  }
}
```

Then run:

```bash
npm run mockit
```
