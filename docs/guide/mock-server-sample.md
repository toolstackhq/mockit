# MockServer Sample

```ts
const server = new MockServer({ port: 3001 });

await server.loadDefaults('./mock-config.ts');
await server.start();

server.expect('/api/checkout')
  .method('POST')
  .count(1)
  .returns(500)
  .withBody({ message: 'payment declined' });

expect(server.verify('/api/checkout')).toBe(true);
```

## Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npx", "mockit", "serve", "--swagger", "./openapi.yaml", "--host", "0.0.0.0", "--port", "3001"]
```

Use `--host 0.0.0.0` in containers so the server is reachable outside the container.
