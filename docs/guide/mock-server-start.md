# MockServer Start

## From Code

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

## From CLI

```bash
mockit serve --config ./mock-config.ts --swagger ./openapi.yaml --port 3001 --host 127.0.0.1
```

This starts the same `MockServer` runtime as a standalone process.

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
