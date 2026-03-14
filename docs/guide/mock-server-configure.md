# MockServer Configure

TypeScript defaults:

```ts
import { defineConfig } from '@toolstackhq/mockit';

export default defineConfig([
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

First-time setup:

```bash
npx @toolstackhq/mockit init
```

That creates a valid starter `mockit.config.ts` you can edit.

OpenAPI:

```ts
await server.loadSwagger('./openapi.yaml');
```

## Swagger Response Data

When MockIt builds a response from Swagger or OpenAPI, it tries to return realistic schema-valid data instead of empty placeholders.

Generation order:

- use `example` values when they exist
- use enum first values when they exist
- use format-aware defaults like email, uuid, date, and uri
- use property-aware fallback strings like:
  - `name` -> `Sample Name`
  - `tag` -> `default-tag`
  - `status` -> `active`
  - `currency` -> `USD`

Example:

```yaml
properties:
  id:
    type: integer
    example: 1
  name:
    type: string
    example: Buddy
  tag:
    type: string
```

Generated response:

```json
{
  "id": 1,
  "name": "Buddy",
  "tag": "default-tag"
}
```

So yes, Swagger mocks are intended to return usable sample data, not just blank bodies.

CLI:

```bash
mockit serve --config ./mock-config.ts --swagger ./openapi.yaml --port 3001
```
