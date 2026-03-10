export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type MockPriority = 'override' | 'default' | 'swagger';

export interface Matcher<T> {
  name: string;
  match(value: T): boolean;
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
  callCount: number;
  calls: RecordedRequest[];
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
