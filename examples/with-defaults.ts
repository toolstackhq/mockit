import { MockServer } from '../src/index.js';
import { resolve } from 'node:path';

async function main() {
  const server = new MockServer({ port: 3001 });

  // Load default mocks from config file
  await server.loadDefaults(resolve(import.meta.dirname, 'mock-config.ts'));

  // Override a specific endpoint for this scenario
  server.expect('/api/users')
    .method('GET')
    .returns(200)
    .withBody([{ id: 99, name: 'Override User' }]);

  const { port } = await server.start();
  console.log(`Mock server running at http://127.0.0.1:${port}`);
  console.log('Defaults loaded + override applied');
  console.log('Try: curl http://127.0.0.1:' + port + '/api/users');
  console.log('Try: curl http://127.0.0.1:' + port + '/api/accounts');

  process.on('SIGINT', async () => {
    await server.stop();
    console.log('Server stopped');
  });
}

main().catch(console.error);
