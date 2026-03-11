# MockServer

## What It Is

`MockServer` starts a real HTTP server. Use it when your app, browser, or another process must call a real mock endpoint.

It can run:

- inside a test or dev script with `new MockServer(...)`
- as a standalone process with `mockit serve ...`
- with test-time updates from `RemoteMockServer`

Best for:

- Playwright or Cypress tests
- frontend development against a fake backend
- cross-process integration tests

You can use it in two ways:

- from code with `new MockServer(...)`
- from the CLI with `mockit serve ...`
- from external tests with `new RemoteMockServer('http://127.0.0.1:3001')`

## Why Run It Standalone

Use standalone mode when:

- devs want the mock always running with the local UI stack
- browser automation should reuse the same running mock
- tests should not be responsible for booting the mock process
- unrelated tests or manual QA should still have a fallback API available

Use the left sidebar for:

- Start
- Configure
- Expectations
- Verification
- Sample
