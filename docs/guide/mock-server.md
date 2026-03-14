# MockServer

## What It Is

`MockServer` starts a real HTTP server.

Use it when your app, browser, or another process must call a real mock endpoint like `http://127.0.0.1:3001`.

It can run:

- inside a test or dev script with `new MockServer(...)`
- as a standalone process with `mockit serve ...`
- with test-time updates from `RemoteMockServer`

It also includes a built-in dashboard at `/_mockit` for viewing loaded mocks and request activity.

Best for:

- manual testing and QA
- Playwright or Cypress tests
- frontend development against a fake backend
- cross-process integration tests

## When To Use It

Use `MockServer` when:

- a browser must call the mock
- a UI dev server must call the mock
- an SDK, CLI, or another process must call the mock
- you want a mock that can stay up even when a test is not running

Use `HttpInterceptor` instead when the code under test is already in the same Node process and does not need a real port.

## How You Run It

You can run it in three ways:

- from code with `new MockServer(...)`
- from the CLI with `npx @toolstackhq/mockit serve ...`
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
