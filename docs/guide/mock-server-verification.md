# MockServer Verification

Verification:

- `verify(path, options?)`
- `verifyCount(path, expectedCount, options?)`
- `verifyNotCalled(path, options?)`
- `explainVerification(path, options?)`

Journal:

- `listRequests()`
- `listUnmatchedRequests()`
- `clearJournal()`
- `pendingMocks()`
- `isDone()`

Admin endpoints:

- `GET /_mockit/api/mocks`
- `GET /_mockit/api/requests`
- `GET /_mockit/api/unmatched`
- `GET /_mockit/api/pending`
- `DELETE /_mockit/api/journal`

## Remote Overrides For Automation Tests

If `MockServer` is running as a separate process, a Playwright or external test runner can create overrides over HTTP.

Create an override:

```ts
await fetch('http://127.0.0.1:3001/_mockit/api/overrides', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    path: '/api/login',
    method: 'POST',
    count: 1,
    response: {
      status: 403,
      body: { message: 'unauthorized' },
    },
  }),
});
```

Clear all overrides:

```ts
await fetch('http://127.0.0.1:3001/_mockit/api/overrides', {
  method: 'DELETE',
});
```

List current overrides:

```ts
const res = await fetch('http://127.0.0.1:3001/_mockit/api/overrides');
const overrides = await res.json();
```

This is the right pattern when:

- devs start MockIt as part of the local UI stack
- automation tests need to change API behavior at runtime
- the test runner does not own the in-memory `MockServer` instance

Remote overrides support the same built-in matchers as local expectations and TypeScript defaults.
