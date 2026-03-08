# MockIt — Enterprise REST/gRPC Mocking Library

## Context
Building a TypeScript mocking library for enterprise banking microservices. Enables developers to programmatically create HTTP mocks with a fluent API, define default responses via config, and override them in tests. Swagger/OpenAPI integration auto-generates mocks from specs.

## User Decisions
- **Modes**: Both standalone HTTP server AND in-process interceptor
- **Protocol**: REST first, gRPC later
- **Config format**: TypeScript files (primary)
- **Package manager**: npm

---

## Project Structure

```
mockit/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Public API exports
│   │
│   ├── core/
│   │   ├── types.ts                # Core interfaces & types
│   │   ├── mock-definition.ts      # MockDefinition data class
│   │   ├── mock-registry.ts        # Stores & resolves mocks (defaults + overrides)
│   │   └── mock-scope.ts           # Scoped mock context for tests
│   │
│   ├── matchers/
│   │   ├── index.ts                # Re-exports all matchers
│   │   ├── types.ts                # Matcher<T> interface
│   │   ├── string-matchers.ts      # equals, startsWith, endsWith, contains, regex
│   │   ├── number-matchers.ts      # greaterThan, lessThan, between, equals
│   │   └── body-matchers.ts        # JSONPath-based body matching ($.name, $.age)
│   │
│   ├── builder/
│   │   ├── expect-builder.ts       # Fluent API: mock.expect('/path')...
│   │   └── response-builder.ts     # .returns(200).withBody({})...
│   │
│   ├── server/
│   │   ├── mock-server.ts          # Standalone HTTP server (node:http)
│   │   └── request-handler.ts      # Core request→mock resolution logic
│   │
│   ├── interceptor/
│   │   └── http-interceptor.ts     # In-process HTTP interception (undici/msw approach)
│   │
│   ├── config/
│   │   ├── config-loader.ts        # Loads default mocks from TS config files
│   │   └── types.ts                # Config file schema types
│   │
│   └── swagger/
│       ├── swagger-loader.ts       # Parse OpenAPI spec (file or URL)
│       ├── schema-to-mock.ts       # Generate mock responses from JSON Schema
│       └── swagger-registry.ts     # Register swagger-generated defaults
│
├── tests/
│   ├── matchers/
│   │   ├── string-matchers.test.ts
│   │   ├── number-matchers.test.ts
│   │   └── body-matchers.test.ts
│   ├── builder/
│   │   └── expect-builder.test.ts
│   ├── server/
│   │   └── mock-server.test.ts
│   ├── interceptor/
│   │   └── http-interceptor.test.ts
│   ├── config/
│   │   └── config-loader.test.ts
│   ├── swagger/
│   │   └── swagger-loader.test.ts
│   └── integration/
│       ├── e2e-server.test.ts
│       └── e2e-interceptor.test.ts
│
└── examples/
    ├── basic-server.ts
    ├── basic-interceptor.ts
    ├── with-defaults.ts
    ├── with-swagger.ts
    └── mock-config.ts              # Example default config file
```

---

## Core Interfaces

### 1. Matcher<T>
```ts
interface Matcher<T> {
  name: string;                    // For error messages: "startsWith('ey')"
  match(value: T): boolean;
}

// Factory functions
equals(value)          // Exact match
startsWith(prefix)     // String prefix
endsWith(suffix)       // String suffix
contains(substring)    // String contains
regex(pattern)         // Regex match
greaterThan(n)         // Numeric >
lessThan(n)            // Numeric <
between(min, max)      // Numeric range
any()                  // Always matches
```

### 2. MockDefinition
```ts
interface MockDefinition {
  id: string;                      // Auto-generated UUID
  path: string;                    // URL pattern, supports :params
  method?: HttpMethod;             // GET, POST, etc. Default: any
  priority: 'override' | 'default' | 'swagger';

  // Request matchers
  headerMatchers: Map<string, Matcher<string>>;
  queryMatchers: Map<string, Matcher<string>>;
  bodyMatchers: Array<{ jsonPath: string; matcher: Matcher<any> }>;

  // Response
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
    delay?: number;                // Simulate latency
  };

  // Tracking
  callCount: number;
  calls: RecordedRequest[];        // For assertions
}
```

### 3. Fluent Builder API
```ts
// Entry point
mock.expect('/api/users/:id')      // returns ExpectBuilder

// ExpectBuilder chains
  .method('GET')                   // HTTP method filter
  .matchHeader(name, matcher)      // Header matching
  .matchQuery(name, matcher)       // Query param matching
  .matchBody(jsonPath, matcher)    // JSONPath body matching
  .returns(status)                 // returns ResponseBuilder

// ResponseBuilder chains
  .withHeaders({...})              // Response headers
  .withBody({...})                 // Response body
  .withDelay(ms)                   // Simulate latency
  .withBodyFromFile(path)          // Load body from JSON file
```

### 4. MockRegistry — Resolution Strategy
```
Request comes in → try to match against:
  1. Programmatic overrides (priority: 'override')  — HIGHEST
  2. Default config mocks (priority: 'default')     — MEDIUM
  3. Swagger-generated mocks (priority: 'swagger')  — LOWEST

Within each priority level, more specific matchers win (most matchers = best match).
If no match found → return 501 with helpful error listing available mocks.
```

### 5. Default Config File Format (TypeScript)
```ts
// mock-config.ts
import { defineDefaults, equals } from 'mockit';

export default defineDefaults([
  {
    path: '/api/users',
    method: 'GET',
    response: {
      status: 200,
      body: [{ id: 1, name: 'Default User' }]
    }
  },
  {
    path: '/api/users/:id',
    method: 'GET',
    matchers: {
      headers: { 'Authorization': startsWith('Bearer') }
    },
    response: {
      status: 200,
      body: { id: 1, name: 'Default User' }
    }
  }
]);
```

### 6. Swagger Integration
```ts
const mock = new MockIt();
await mock.loadSwagger('./openapi.yaml');
// or
await mock.loadSwagger('https://api.example.com/swagger.json');

// All paths from spec get auto-mocked with generated example data
// User can still override any path programmatically
```

---

## Implementation Order (10 Steps)

### Step 1: Project scaffold
- `npm init`, `tsconfig.json`, vitest, eslint
- Directory structure
- Dependencies: `vitest`, `typescript`, `@apidevtools/swagger-parser`, `json-schema-faker`, `jsonpath-plus`

### Step 2: Core types (`src/core/types.ts`)
- All interfaces: MockDefinition, HttpMethod, RecordedRequest, etc.

### Step 3: Matchers (`src/matchers/`)
- Matcher<T> interface
- All matcher factory functions
- Unit tests for every matcher

### Step 4: Fluent Builder (`src/builder/`)
- ExpectBuilder + ResponseBuilder
- Builder returns MockDefinition
- Unit tests

### Step 5: MockRegistry (`src/core/mock-registry.ts`)
- Store mocks by priority
- Request matching logic with scoring
- Resolution: override > default > swagger
- Unit tests

### Step 6: Request Handler (`src/server/request-handler.ts`)
- Core logic: parse incoming request → query registry → return response
- Shared between server and interceptor modes
- Unit tests

### Step 7: Standalone Server (`src/server/mock-server.ts`)
- `node:http` based server (zero deps)
- `server.start(port)` / `server.stop()`
- Integration tests

### Step 8: In-process Interceptor (`src/interceptor/`)
- Hook into Node.js `undici` / global `fetch`
- `interceptor.enable()` / `interceptor.disable()`
- Integration tests

### Step 9: Config Loader (`src/config/`)
- Load TypeScript config files using dynamic import
- `defineDefaults()` helper function
- Register loaded mocks as 'default' priority

### Step 10: Swagger Integration (`src/swagger/`)
- Parse OpenAPI 3.x specs with `@apidevtools/swagger-parser`
- Generate mock responses from schema examples or `json-schema-faker`
- Register as 'swagger' priority (lowest)

---

## Public API (src/index.ts)

```ts
// Core
export { MockIt } from './core/mock-scope';
export { MockServer } from './server/mock-server';
export { HttpInterceptor } from './interceptor/http-interceptor';

// Config
export { defineDefaults } from './config/types';

// Matchers
export {
  equals, startsWith, endsWith, contains, regex,
  greaterThan, lessThan, between, any
} from './matchers';
```

## Usage Examples

### Standalone Server (System Tests)
```ts
import { MockServer, startsWith } from 'mockit';

const server = new MockServer({ port: 3001 });
await server.loadDefaults('./mock-config.ts');

server.expect('/api/auth/login')
  .method('POST')
  .matchBody('$.email', equals('test@bank.com'))
  .returns(200)
  .withBody({ token: 'jwt-token-here' });

await server.start();
// Your service under test points to http://localhost:3001
```

### In-Process Interceptor (Unit/Integration Tests)
```ts
import { HttpInterceptor, equals } from 'mockit';

const mock = new HttpInterceptor();
mock.expect('https://api.internal/users')
  .method('GET')
  .returns(200)
  .withBody([{ id: 1, name: 'Test User' }]);

mock.enable();
// fetch('https://api.internal/users') → returns mock
// ...run tests...
mock.disable();
```

### Test Scoping
```ts
describe('Payment Service', () => {
  const server = new MockServer({ port: 3001 });

  beforeAll(async () => {
    await server.loadDefaults('./mock-config.ts');
    await server.start();
  });

  afterAll(() => server.stop());
  afterEach(() => server.resetOverrides()); // Keep defaults, clear test mocks

  it('handles payment failure', () => {
    server.expect('/api/payment/charge')
      .method('POST')
      .returns(402)
      .withBody({ error: 'Card declined' });

    // Test runs against default mocks EXCEPT payment which returns 402
  });
});
```

---

## Dependencies
- `typescript` — language
- `vitest` — testing
- `@apidevtools/swagger-parser` — OpenAPI parsing
- `json-schema-faker` — generate mock data from JSON Schema
- `jsonpath-plus` — JSONPath evaluation for body matching
- No Express — use `node:http` to stay lightweight

## Verification
1. Run `npm test` — all unit + integration tests pass
2. Run `npx ts-node examples/basic-server.ts` — server starts, curl returns mocks
3. Run `npx ts-node examples/with-swagger.ts` — swagger-generated mocks served
