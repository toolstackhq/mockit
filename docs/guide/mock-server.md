# MockServer

## What It Is

`MockServer` starts a real HTTP server. Use it when your app, browser, or another process must call a real mock endpoint.

Best for:

- Playwright or Cypress tests
- frontend development against a fake backend
- cross-process integration tests

You can use it in two ways:

- from code with `new MockServer(...)`
- from the CLI with `mockit serve ...`
- from external tests with `new RemoteMockServer('http://127.0.0.1:3001')`

Use the left sidebar for:

- Start
- Configure
- Expectations
- Verification
- Sample
