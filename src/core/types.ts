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

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  delay?: number;
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
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
    query?: Record<string, Matcher<string>>;
    body?: Array<{ jsonPath: string; matcher: Matcher<any> }>;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
  };
}

export interface MockServerOptions {
  port?: number;
  host?: string;
}
