# MockServer Configure

TypeScript defaults:

```ts
import { defineDefaults } from '@toolstackhq/mockit';

export default defineDefaults([
  {
    path: '/api/users',
    method: 'GET',
    response: {
      status: 200,
      body: [{ id: 1, name: 'Default User' }],
    },
  },
]);
```

```ts
await server.loadDefaults('./mock-config.ts');
```

OpenAPI:

```ts
await server.loadSwagger('./openapi.yaml');
```

CLI:

```bash
mockit serve --config ./mock-config.ts --swagger ./openapi.yaml --port 3001
```
