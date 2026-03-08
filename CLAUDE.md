# MockIt — Enterprise REST/gRPC Mocking Library

## What This Is
A TypeScript mocking library for enterprise banking microservices. Enables developers to programmatically create HTTP mocks with a fluent API, define default responses via config, and override them in tests. Has Swagger/OpenAPI integration to auto-generate mocks from specs.

## Quick Commands
- `npm test` — run all tests (vitest)
- `npm run build` — compile TypeScript
- `npx tsc --noEmit` — type-check without emitting

## Tech Stack
- **Language**: TypeScript (ESM, `"type": "module"`)
- **Runtime**: Node.js
- **Test framework**: Vitest (globals enabled)
- **Package manager**: npm
- **No Express** — uses `node:http` for the server

## Dependencies
- `jsonpath-plus` — JSONPath evaluation for body matching
- `@apidevtools/swagger-parser` — OpenAPI spec parsing
- `json-schema-faker` — (installed but not used yet; schema-to-mock.ts uses a custom lightweight generator instead)

## Project Structure
```
src/
├── index.ts                    # Public API exports
├── core/
│   ├── types.ts                # All interfaces: MockDefinitionData, HttpMethod, Matcher<T>, etc.
│   ├── mock-definition.ts      # MockDefinition class (data + call tracking)
│   ├── mock-registry.ts        # Stores & resolves mocks with priority scoring
│   └── mock-scope.ts           # MockIt base class (expect, resetOverrides, listMocks)
├── matchers/
│   ├── index.ts                # Re-exports + any() matcher
│   ├── types.ts                # Re-exports Matcher<T> from core
│   ├── string-matchers.ts      # equals, startsWith, endsWith, contains, regex
│   ├── number-matchers.ts      # greaterThan, lessThan, between, equalsNumber
│   └── body-matchers.ts        # JSONPath-based body matching (evaluateBodyMatcher)
├── builder/
│   ├── expect-builder.ts       # Fluent API entry: .method().matchHeader().matchBody().returns()
│   └── response-builder.ts     # .withBody().withHeaders().withDelay().withBodyFromFile()
├── server/
│   ├── mock-server.ts          # MockServer extends MockIt — standalone HTTP server (node:http)
│   ├── request-handler.ts      # Core request→mock resolution, shared between server & interceptor
│   └── dashboard.ts            # HTML dashboard renderer + JSON API (served at /_mockit)
├── interceptor/
│   └── http-interceptor.ts     # HttpInterceptor extends MockIt — patches globalThis.fetch
├── config/
│   ├── config-loader.ts        # Loads TS config files via dynamic import()
│   └── types.ts                # defineDefaults() helper
└── swagger/
    ├── swagger-loader.ts       # Parse OpenAPI 3.x specs
    ├── schema-to-mock.ts       # Generate mock values from JSON Schema objects
    └── swagger-registry.ts     # loadSwaggerMocks() → MockDefinition[]

tests/
├── matchers/                   # Unit tests for all matcher types
├── builder/                    # ExpectBuilder + ResponseBuilder tests
├── core/                       # MockRegistry resolution tests
├── server/                     # MockServer integration tests
├── interceptor/                # HttpInterceptor tests
├── config/
│   ├── config-loader.test.ts
│   └── fixtures/test-config.ts # Test fixture config file
├── swagger/
│   ├── swagger-loader.test.ts
│   └── fixtures/petstore.yaml  # Test fixture OpenAPI spec
└── integration/
    ├── e2e-server.test.ts      # Full E2E: config loading + overrides + reset
    └── e2e-interceptor.test.ts # Full E2E: fetch interception

examples/
├── basic-server.ts             # Standalone server example
├── basic-interceptor.ts        # Fetch interception example
├── with-defaults.ts            # Loading defaults from config
├── with-swagger.ts             # Loading mocks from OpenAPI spec
└── mock-config.ts              # Example default config file
```

## Architecture & Key Concepts

### Priority Resolution (MockRegistry)
Request matching follows priority order: `override` (highest) > `default` > `swagger` (lowest).
Within the same priority, the mock with the most matching criteria (method + headers + query + body matchers) wins.
Unmatched requests return 501 with a list of available mocks.

### Dashboard (MockServer only)
- `GET /_mockit` — HTML dashboard showing all registered mocks, grouped by priority, with matchers, response bodies, and call counts
- `GET /_mockit/api/mocks` — JSON API returning mock details programmatically
- Dashboard routes are handled before mock resolution, so they won't conflict with user mocks (unless user registers a GET on `/_mockit` exactly)

### Two Modes
1. **MockServer** — standalone HTTP server on `node:http`. Use `server.start()` / `server.stop()`.
2. **HttpInterceptor** — patches `globalThis.fetch` in-process. Use `interceptor.enable()` / `interceptor.disable()`.

Both extend `MockIt` base class and share the same `MockRegistry` and fluent builder API.

### Fluent Builder Pattern
```ts
server.expect('/api/users/:id')
  .method('GET')
  .matchHeader('Authorization', startsWith('Bearer'))
  .matchQuery('page', equals('1'))
  .matchBody('$.name', equals('John'))
  .returns(200)
  .withBody({ id: 1 })
  .withHeaders({ 'X-Custom': 'value' })
  .withDelay(100);
```
`ExpectBuilder.returns(status)` triggers registration in the registry and returns a `ResponseBuilder`.

### Test Scoping
- `resetOverrides()` — clears only `override` priority mocks, keeps `default` and `swagger`
- `resetAll()` — clears everything
- Mocks track `callCount` and `calls[]` (RecordedRequest) for assertions

### Config Loading
- `server.loadDefaults('./config.ts')` — dynamic-imports a TS file that exports `defineDefaults([...])`
- Loaded mocks get `default` priority

### Swagger Integration
- `server.loadSwagger('./openapi.yaml')` — parses OpenAPI 3.x, generates mock responses
- Converts `{id}` path params to `:id` format
- Generated mocks get `swagger` priority (lowest)
- Uses schema examples when available, falls back to type-based generation

## Coding Conventions
- ESM imports with `.js` extensions (e.g., `import { X } from './foo.js'`)
- Vitest with `describe`/`it`/`expect` (globals enabled)
- Header keys are normalized to lowercase in matching
- Path matching supports `:param` segments (any value matches)
- No classes are abstract — MockIt is a concrete base, MockServer and HttpInterceptor extend it
- Swagger types are defined locally in `schema-to-mock.ts` (SchemaObject interface) rather than importing from the parser package

## Current Status (March 2026)
- All 113 tests pass
- TypeScript compiles cleanly (`tsc --noEmit` succeeds)
- REST support is complete
- gRPC support is planned for later
- `json-schema-faker` is installed but not yet integrated (using custom `schemaToMockValue` instead)
