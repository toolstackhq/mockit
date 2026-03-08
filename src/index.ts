// Core
export { MockIt } from './core/mock-scope.js';
export { MockServer } from './server/mock-server.js';
export { HttpInterceptor } from './interceptor/http-interceptor.js';
export { MockDefinition } from './core/mock-definition.js';

// Config
export { defineDefaults } from './config/types.js';

// Matchers
export {
  equals, startsWith, endsWith, contains, regex,
  greaterThan, lessThan, between, equalsNumber,
  any, bodyPath,
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
  Matcher,
  BodyMatcher,
} from './core/types.js';
