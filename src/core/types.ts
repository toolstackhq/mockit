export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type MockPriority = 'override' | 'default' | 'swagger';

export interface Matcher<T> {
  name: string;
  match(value: T): boolean;
  serialize(): RemoteMatcherSpec;
}

export interface BodyMatcher {
  jsonPath: string;
  matcher: Matcher<any>;
}

export interface DelayRange {
  min: number;
  max: number;
}

export type FaultType = 'connection-reset' | 'empty-response';

export type UnhandledRequestMode = 'fail' | 'passthrough' | 'proxy';

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  delay?: number;
  delayRange?: DelayRange;
  template?: boolean;
  fault?: FaultType;
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  query: Record<string, string>;
  body: any;
  timestamp: number;
}

export interface MockDefinitionData {
  id: string;
  path: string;
  method?: HttpMethod;
  priority: MockPriority;
  headerMatchers: Map<string, Matcher<string>>;
  cookieMatchers: Map<string, Matcher<string>>;
  queryMatchers: Map<string, Matcher<string>>;
  bodyMatchers: BodyMatcher[];
  response: MockResponse;
  responseSequence: MockResponse[];
  callCount: number;
  calls: RecordedRequest[];
  optional: boolean;
  persisted: boolean;
  remainingUses?: number;
}

export interface DefaultMockConfig {
  path: string;
  method?: HttpMethod;
  matchers?: {
    headers?: Record<string, Matcher<string>>;
    cookies?: Record<string, Matcher<string>>;
    query?: Record<string, Matcher<string>>;
    body?: Array<{ jsonPath: string; matcher: Matcher<any> }>;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
    delay?: number;
    delayRange?: DelayRange;
    template?: boolean;
    fault?: FaultType;
  };
}

export interface MockServerOptions {
  port?: number;
  host?: string;
  onUnhandled?: Extract<UnhandledRequestMode, 'fail' | 'proxy'>;
  proxyBaseUrl?: string;
  recordProxiedResponses?: boolean;
}

export interface HttpInterceptorOptions {
  onUnhandled?: UnhandledRequestMode;
  proxyBaseUrl?: string;
  recordProxiedResponses?: boolean;
}

export interface VerifyOptions {
  method?: HttpMethod;
  priority?: MockPriority;
  id?: string;
}

export interface VerificationEntry {
  id: string;
  path: string;
  method?: HttpMethod;
  priority: MockPriority;
  callCount: number;
  isInvoked: boolean;
}

export interface VerificationExplanation {
  path: string;
  method?: HttpMethod;
  priority?: MockPriority;
  id?: string;
  matchedMocks: number;
  totalCallCount: number;
  mocks: VerificationEntry[];
}

export interface NearMiss {
  id: string;
  path: string;
  method?: HttpMethod;
  priority: MockPriority;
  score: number;
  reasons: string[];
}

export interface RequestJournalEntry extends RecordedRequest {
  matched: boolean;
  proxied: boolean;
  mockId?: string;
  mockPath?: string;
  mockPriority?: MockPriority;
  responseStatus?: number;
  nearMisses: NearMiss[];
}

export interface RemoteMatcherSpec {
  equals?: any;
  startsWith?: string;
  endsWith?: string;
  contains?: string;
  regex?: {
    pattern: string;
    flags?: string;
  };
  greaterThan?: number;
  lessThan?: number;
  between?: [number, number];
  any?: boolean;
  bearerToken?: RemoteMatcherSpec;
}

export interface RemoteBodyMatcherSpec {
  jsonPath: string;
  matcher: RemoteMatcherSpec;
}

export interface RemoteResponseSpec {
  status: number;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
  delayRange?: DelayRange;
  template?: boolean;
  fault?: FaultType;
}

export interface RemoteOverrideRequest {
  path: string;
  method?: HttpMethod;
  count?: number;
  optional?: boolean;
  matchers?: {
    headers?: Record<string, RemoteMatcherSpec>;
    cookies?: Record<string, RemoteMatcherSpec>;
    query?: Record<string, RemoteMatcherSpec>;
    body?: RemoteBodyMatcherSpec[];
    bodyEquals?: any;
  };
  response: RemoteResponseSpec;
  sequence?: RemoteResponseSpec[];
}
