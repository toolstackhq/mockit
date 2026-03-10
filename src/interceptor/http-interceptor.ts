import { MockIt } from '../core/mock-scope.js';
import {
  renderResponseBody,
  renderResponseHeaders,
  resolveDelay,
  type RuntimeRequestContext,
} from '../core/response-runtime.js';
import { parseCookies } from '../server/request-handler.js';

type FetchInput = string | URL | Request;

export class HttpInterceptor extends MockIt {
  private originalFetch: typeof globalThis.fetch | null = null;
  private active = false;

  enable(): void {
    if (this.active) return;
    this.originalFetch = globalThis.fetch;
    this.active = true;

    const registry = this.registry;
    globalThis.fetch = async (input: FetchInput, init?: RequestInit): Promise<Response> => {
      const { method, path, headers, cookies, query, body } = await parseInterceptedRequest(input, init);
      const requestContext: RuntimeRequestContext = { method, path, headers, cookies, query, body };

      const mock = registry.resolve(requestContext);

      if (!mock) {
        // Pass through to original fetch if no mock matches
        return this.originalFetch!(input, init);
      }

      if (mock.response.fault === 'connection-reset') {
        throw new TypeError('MockIt simulated fault: connection reset');
      }

      const delay = resolveDelay(mock.response);
      if (delay !== undefined) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (mock.response.fault === 'empty-response') {
        return new Response(null, {
          status: mock.response.status,
          headers: {
            'Content-Type': 'application/json',
            ...renderResponseHeaders(mock.response.headers, requestContext),
          },
        });
      }

      const renderedBody = renderResponseBody(mock.response, requestContext);
      const responseBody = renderedBody !== null && renderedBody !== undefined
        ? (typeof renderedBody === 'string' ? renderedBody : JSON.stringify(renderedBody))
        : null;

      const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...renderResponseHeaders(mock.response.headers, requestContext),
      };

      return new Response(responseBody, {
        status: mock.response.status,
        headers: responseHeaders,
      });
    };
  }

  disable(): void {
    if (!this.active) return;
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    this.active = false;
  }

  get isActive(): boolean {
    return this.active;
  }

  async loadDefaults(configPath: string): Promise<void> {
    const { loadConfig } = await import('../config/config-loader.js');
    const defs = await loadConfig(configPath);
    for (const def of defs) {
      this.registry.add(def);
    }
  }

  async loadSwagger(source: string): Promise<void> {
    const { loadSwaggerMocks } = await import('../swagger/swagger-registry.js');
    const defs = await loadSwaggerMocks(source);
    for (const def of defs) {
      this.registry.add(def);
    }
  }
}

async function parseInterceptedRequest(
  input: FetchInput,
  init?: RequestInit,
): Promise<{
  method: string;
  path: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  query: Record<string, string>;
  body: any;
}> {
  let url: URL;
  let method = 'GET';
  let headers: Record<string, string> = {};
  let rawBody: any = null;

  if (input instanceof URL) {
    url = input;
  } else if (typeof input === 'string') {
    url = new URL(input, 'http://localhost');
  } else {
    // Request object
    url = new URL(input.url, 'http://localhost');
    method = input.method;
    input.headers.forEach((value: string, key: string) => {
      headers[key.toLowerCase()] = value;
    });
    if (input.body) {
      try {
        rawBody = await input.json();
      } catch {
        rawBody = null;
      }
    }
  }

  if (init) {
    method = init.method || method;
    if (init.headers) {
      const h = new Headers(init.headers);
      h.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    }
    if (init.body) {
      try {
        rawBody = JSON.parse(String(init.body));
      } catch {
        rawBody = String(init.body);
      }
    }
  }

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  const cookies = parseCookies(headers.cookie);

  // Use the full path including hostname for URL-based matching
  const path = url.pathname;

  return { method, path, headers, cookies, query, body: rawBody };
}
