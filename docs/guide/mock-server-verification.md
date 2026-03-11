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

## Important Note For Automation Tests

If `MockServer` is running as a separate process, a Playwright test cannot call `mockit.expect(...)` directly against that process today.

That works only when the test owns the `MockServer` instance in the same Node process.

For a separately running mock process, the current options are:

- start it with defaults or Swagger
- inspect it through the read-only admin endpoints above

If remote test-time override is needed, the next feature to add is a write admin API for creating and clearing overrides over HTTP.
