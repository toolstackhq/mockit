import { MockIt } from '../core/mock-scope.js';
import {
  renderResponseBody,
  renderResponseHeaders,
  resolveDelay,
  type RuntimeRequestContext,
} from '../core/response-runtime.js';
import { parseCookies } from '../server/request-handler.js';
import type { HttpInterceptorOptions } from '../core/types.js';
import { proxyRequest } from '../shared/proxy.js';

type FetchInput = string | URL | Request;

export class HttpInterceptor extends MockIt {
  private originalFetch: typeof globalThis.fetch | null = null;
  private active = false;
  private onUnhandled: NonNullable<HttpInterceptorOptions['onUnhandled']>;
  private proxyBaseUrl?: string;
  private recordProxiedResponses: boolean;

  constructor(options: HttpInterceptorOptions = {}) {
    super();
    this.onUnhandled = options.onUnhandled || 'passthrough';
    this.proxyBaseUrl = options.proxyBaseUrl;
    this.recordProxiedResponses = options.recordProxiedResponses || false;
  }

  enable(): void {
    if (this.active) return;
    this.originalFetch = globalThis.fetch;
    this.active = true;

    const registry = this.registry;
    globalThis.fetch = async (input: FetchInput, init?: RequestInit): Promise<Response> => {
      const { method, path, headers, cookies, query, body, rawBody } = await parseInterceptedRequest(input, init);
      const requestContext: RuntimeRequestContext = { method, path, headers, cookies, query, body };

      const resolution = registry.resolveDetailed(requestContext);
      const mock = resolution.mock;
      const response = resolution.response;

      if (!mock || !response) {
        if (this.onUnhandled === 'proxy' && this.proxyBaseUrl) {
          const proxied = await proxyRequest(this.proxyBaseUrl, {
            method,
            path,
            query,
            headers,
            rawBody,
          }, this.originalFetch!);
          registry.recordProxied(requestContext, proxied.response.status, resolution.nearMisses);
          if (this.recordProxiedResponses) {
            registry.recordProxyMock(requestContext, proxied.response);
          }

          return new Response(
            proxied.response.body === null || proxied.response.body === undefined
              ? null
              : typeof proxied.response.body === 'string'
                ? proxied.response.body
                : JSON.stringify(proxied.response.body),
            {
              status: proxied.response.status,
              headers: proxied.response.headers,
              statusText: proxied.statusText,
            },
          );
        }

        registry.recordUnmatched(requestContext, resolution.nearMisses);
        if (this.onUnhandled === 'fail') {
          throw new Error(`MockIt blocked unhandled request: ${method} ${path}`);
        }
        return this.originalFetch!(input, init);
      }

      registry.recordMatched(requestContext, mock, response);

      if (response.fault === 'connection-reset') {
        throw new TypeError('MockIt simulated fault: connection reset');
      }

      const delay = resolveDelay(response);
      if (delay !== undefined) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (response.fault === 'empty-response') {
        return new Response(null, {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            ...renderResponseHeaders(response.headers, requestContext),
          },
        });
      }

      const renderedBody = renderResponseBody(response, requestContext);
      const responseBody = renderedBody !== null && renderedBody !== undefined
        ? (typeof renderedBody === 'string' ? renderedBody : JSON.stringify(renderedBody))
        : null;

      const responseHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...renderResponseHeaders(response.headers, requestContext),
      };

      return new Response(responseBody, {
        status: response.status,
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

  setUnhandledRequests(
    mode: NonNullable<HttpInterceptorOptions['onUnhandled']>,
    proxyBaseUrl?: string,
    recordProxiedResponses = false,
  ): void {
    this.onUnhandled = mode;
    this.proxyBaseUrl = proxyBaseUrl;
    this.recordProxiedResponses = recordProxiedResponses;
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
  rawBody: string | null;
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
      const clone = input.clone();
      try {
        rawBody = await clone.text();
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
        rawBody = String(init.body);
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

  const path = url.pathname;
  let body: any = rawBody;
  if (typeof rawBody === 'string' && rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  return { method, path, headers, cookies, query, body, rawBody };
}
