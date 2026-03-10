# WireMock Parity Tracker (MockIt)

Snapshot date: March 9, 2026

This file tracks feature parity between WireMock and MockIt so we can incrementally close gaps.

## How To Use This

- Update the `Status` column as work progresses.
- Add implementation notes under `Incremental Plan`.
- Append updates in `Change Log`.

Status legend:

- `✅` implemented
- `🟡` partial
- `❌` missing

## Feature Matrix

| Area | WireMock | MockIt (current) | Gap | Priority | Status |
| --- | --- | --- | --- | --- | --- |
| Basic stubbing | Rich HTTP stubs | Fluent stubs with method/header/query/body + response builders | None for core stubbing | P0 | ✅ |
| Override precedence | Priority/scenario resolution | `override > default > swagger` | None for basic precedence | P0 | ✅ |
| Request matching breadth | URL patterns, headers, query, cookies, body types, auth, multipart, etc. | Path params, method, headers, query, JSONPath body | Advanced matcher coverage | P0 | 🟡 |
| Verification API | Verify by pattern/count, request journal tooling | `callCount`, `calls[]`, `isInvoked()` | Need richer verify DSL + diagnostics | P0 | 🟡 |
| Stateful behavior | Scenario/state-machine stubs | Not available | Scenario states and transitions | P1 | ❌ |
| Dynamic response templating | Handlebars templating and request-derived values | Static body/headers/delay | Templating engine + context vars | P1 | ❌ |
| Fault simulation | Delays + low-level network faults | Fixed delay only | Fault injection types/distributions | P1 | 🟡 |
| Proxy + record/playback | Forward proxy + capture + replay | Not available | Proxy/record/replay pipeline | P1 | ❌ |
| Admin API (CRUD) | Full mapping/admin endpoints | Dashboard + JSON list endpoint | Full create/update/delete admin API | P2 | 🟡 |
| Extensibility | Extension points (matchers/transformers/etc.) | No plugin system | Plugin/extension architecture | P2 | ❌ |
| Protocol breadth | Strong HTTP, ecosystem add-ons | REST-focused | gRPC/GraphQL/webhooks expansion | P2 | ❌ |

## Incremental Plan

## P0: Core Test-Authoring Power

- [ ] Add verification DSL (`verify`, `verifyCount`, `verifyNotCalled`)
- [ ] Add request-level IDs/trace metadata for easier correlation
- [ ] Expand matcher set: cookies, auth, regex URL, JSON equality, JSON schema, form params
- [ ] Add mismatch diagnostics / near-miss reporting

Acceptance target:

- Test authors can assert "which stub was hit, how many times, and why unmatched requests failed" without manual call-history parsing.

## P1: Realistic Behavior

- [ ] Add response templating with request context
- [ ] Add fault injection modes (connection reset, malformed payload/chunk issues, probabilistic latency)
- [ ] Add scenario/stateful behavior transitions
- [ ] Add proxy + record/playback workflow

Acceptance target:

- MockIt can simulate complex, production-like behavior and bootstrap mocks from live traffic.

## P2: Platform/Scale Features

- [ ] Add admin CRUD API for mappings/lifecycle
- [ ] Add persistence/import/export of mappings
- [ ] Add plugin/extension API
- [ ] Add protocol expansion roadmap (gRPC first)

Acceptance target:

- MockIt supports larger team workflows and extensible enterprise use.

## Change Log

- 2026-03-09: Initial parity baseline created.

## Reference

- https://wiremock.org/docs/
