// Core
export { MockIt } from './core/mock-scope.js';
export { MockServer } from './server/mock-server.js';
export { HttpInterceptor } from './interceptor/http-interceptor.js';
export { RemoteMockServer } from './remote/remote-mock-server.js';
export { MockDefinition } from './core/mock-definition.js';

// Config
export { defineDefaults } from './config/types.js';

// Matchers
export {
  equals, startsWith, endsWith, contains, regex,
  greaterThan, lessThan, between, equalsNumber,
  any, bodyPath, equalsJson,
} from './matchers/index.js';

// Types
export type {
  HttpMethod,
  MockPriority,
  MockResponse,
  RecordedRequest,
  MockDefinitionData,
  DefaultMockConfig,
  MockServerOptions,
  HttpInterceptorOptions,
  Matcher,
  BodyMatcher,
  FaultType,
  VerifyOptions,
  VerificationEntry,
  VerificationExplanation,
  UnhandledRequestMode,
  RequestJournalEntry,
  NearMiss,
  RemoteOverrideRequest,
  RemoteMatcherSpec,
  RemoteBodyMatcherSpec,
  RemoteResponseSpec,
} from './core/types.js';
