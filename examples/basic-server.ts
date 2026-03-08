import { MockServer, equals } from '../src/index.js';

async function main() {
  const server = new MockServer({ port: 3001 });

  // Set up mock endpoints
  server.expect('/api/users')
    .method('GET')
    .returns(200)
    .withBody([
      { id: 1, name: 'Test User', email: 'test@bank.com' },
    ]);

  server.expect('/api/users/:id')
    .method('GET')
    .returns(200)
    .withBody({ id: 1, name: 'Test User', email: 'test@bank.com' });

  server.expect('/api/auth/login')
    .method('POST')
    .matchBody('$.email', equals('test@bank.com'))
    .returns(200)
    .withBody({ token: 'jwt-token-here', expiresIn: 3600 });

  const { port } = await server.start();
  console.log(`Mock server running at http://127.0.0.1:${port}`);
  console.log('Try: curl http://127.0.0.1:' + port + '/api/users');

  // Keep running until interrupted
  process.on('SIGINT', async () => {
    await server.stop();
    console.log('Server stopped');
  });
}

main().catch(console.error);
