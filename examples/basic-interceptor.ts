import { HttpInterceptor, equals } from '../src/index.js';

async function main() {
  const mock = new HttpInterceptor();

  mock.expect('/api/users')
    .method('GET')
    .returns(200)
    .withBody([{ id: 1, name: 'Test User' }]);

  mock.expect('/api/users')
    .method('POST')
    .matchBody('$.name', equals('John'))
    .returns(201)
    .withBody({ id: 2, name: 'John' });

  mock.enable();

  // These fetch calls will be intercepted
  const usersRes = await fetch('http://api.internal/api/users');
  console.log('GET /api/users:', await usersRes.json());

  const createRes = await fetch('http://api.internal/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'John' }),
  });
  console.log('POST /api/users:', await createRes.json());

  mock.disable();
  console.log('Interceptor disabled, fetch restored');
}

main().catch(console.error);
