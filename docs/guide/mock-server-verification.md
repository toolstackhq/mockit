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
