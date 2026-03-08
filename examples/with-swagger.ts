import { MockServer } from '../src/index.js';
import { resolve } from 'node:path';

async function main() {
  const server = new MockServer({ port: 3001 });

  // Load mocks auto-generated from OpenAPI spec
  await server.loadSwagger(resolve(import.meta.dirname, '../tests/swagger/fixtures/petstore.yaml'));

  // Override a specific endpoint
  server.expect('/pets')
    .method('GET')
    .returns(200)
    .withBody([
      { id: 1, name: 'Custom Dog', tag: 'dog' },
      { id: 2, name: 'Custom Cat', tag: 'cat' },
    ]);

  const { port } = await server.start();
  console.log(`Mock server running at http://127.0.0.1:${port}`);
  console.log('Swagger mocks loaded + override for /pets');
  console.log('Try: curl http://127.0.0.1:' + port + '/pets');
  console.log('Try: curl http://127.0.0.1:' + port + '/pets/1');

  process.on('SIGINT', async () => {
    await server.stop();
    console.log('Server stopped');
  });
}

main().catch(console.error);
