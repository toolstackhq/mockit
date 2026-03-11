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
