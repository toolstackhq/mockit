import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
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
type RequestCallback = (res: import('node:http').IncomingMessage) => void;
type PatchedRequest = typeof import('node:http').request;
type PatchedGet = typeof import('node:http').get;
type Protocol = 'http:' | 'https:';

interface RequestResolutionData {
  method: string;
  path: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  query: Record<string, string>;
  body: any;
  rawBody: string | null;
}

interface NormalizedNodeRequest {
  protocol: Protocol;
  url: URL;
  method: string;
  headers: Record<string, string>;
}

const require = createRequire(import.meta.url);
const http = require('node:http') as typeof import('node:http');
const https = require('node:https') as typeof import('node:https');

export class HttpInterceptor extends MockIt {
  private originalFetch: typeof globalThis.fetch | null = null;
  private originalHttpRequest: PatchedRequest | null = null;
  private originalHttpGet: PatchedGet | null = null;
  private originalHttpsRequest: PatchedRequest | null = null;
  private originalHttpsGet: PatchedGet | null = null;
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
    this.originalHttpRequest = http.request;
    this.originalHttpGet = http.get;
    this.originalHttpsRequest = https.request;
    this.originalHttpsGet = https.get;
    this.active = true;

    const registry = this.registry;
    globalThis.fetch = async (input: FetchInput, init?: RequestInit): Promise<Response> => {
      const request = await parseInterceptedRequest(input, init);
      return this.resolveFetchResponse(request, input, init);
    };

    http.request = this.createPatchedRequest('http:', this.originalHttpRequest);
    http.get = this.createPatchedGet(http.request);
    https.request = this.createPatchedRequest('https:', this.originalHttpsRequest);
    https.get = this.createPatchedGet(https.request);
  }

  disable(): void {
    if (!this.active) return;
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    if (this.originalHttpRequest) {
      http.request = this.originalHttpRequest;
      this.originalHttpRequest = null;
    }
    if (this.originalHttpGet) {
      http.get = this.originalHttpGet;
      this.originalHttpGet = null;
    }
    if (this.originalHttpsRequest) {
      https.request = this.originalHttpsRequest;
      this.originalHttpsRequest = null;
    }
    if (this.originalHttpsGet) {
      https.get = this.originalHttpsGet;
      this.originalHttpsGet = null;
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

  private createPatchedRequest(protocol: Protocol, originalRequest: PatchedRequest): PatchedRequest {
    return ((...args: any[]) => {
      const callback = extractNodeRequestCallback(args);
      const normalized = normalizeNodeRequestArgs(protocol, args);
      const request = new InterceptedClientRequest(
        normalized,
        async (data) => this.resolveNodeRequest(normalized, data, originalRequest, callback),
        callback,
      );
      return request as unknown as import('node:http').ClientRequest;
    }) as PatchedRequest;
  }

  private createPatchedGet(requestImpl: PatchedRequest): PatchedGet {
    return ((...args: any[]) => {
      const req = (requestImpl as any)(...args);
      req.end();
      return req;
    }) as PatchedGet;
  }

  private async resolveFetchResponse(
    request: RequestResolutionData,
    input: FetchInput,
    init?: RequestInit,
  ): Promise<Response> {
    const resolution = this.resolveRequest(request);
    const mock = resolution.mock;
    const response = resolution.response;

    if (!mock || !response) {
      if (this.onUnhandled === 'proxy' && this.proxyBaseUrl) {
        const proxied = await proxyRequest(this.proxyBaseUrl, {
          method: request.method,
          path: request.path,
          query: request.query,
          headers: request.headers,
          rawBody: request.rawBody,
        }, this.originalFetch!);
        this.registry.recordProxied(this.toRequestContext(request), proxied.response.status, resolution.nearMisses);
        if (this.recordProxiedResponses) {
          this.registry.recordProxyMock(this.toRequestContext(request), proxied.response);
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

      this.registry.recordUnmatched(this.toRequestContext(request), resolution.nearMisses);
      if (this.onUnhandled === 'fail') {
        throw new Error(`MockIt blocked unhandled request: ${request.method} ${request.path}`);
      }
      return this.originalFetch!(input, init);
    }

    this.registry.recordMatched(this.toRequestContext(request), mock, response);

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
          ...renderResponseHeaders(response.headers, this.toRequestContext(request)),
        },
      });
    }

    const renderedBody = renderResponseBody(response, this.toRequestContext(request));
    const responseBody = renderedBody !== null && renderedBody !== undefined
      ? (typeof renderedBody === 'string' ? renderedBody : JSON.stringify(renderedBody))
      : null;

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...renderResponseHeaders(response.headers, this.toRequestContext(request)),
    };

    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  }

  private async resolveNodeRequest(
    normalized: NormalizedNodeRequest,
    request: RequestResolutionData,
    originalRequest: PatchedRequest,
    callback?: RequestCallback,
  ): Promise<MockedNodeResult> {
    const resolution = this.resolveRequest(request);
    const mock = resolution.mock;
    const response = resolution.response;
    const requestContext = this.toRequestContext(request);

    if (!mock || !response) {
      if (this.onUnhandled === 'proxy' && this.proxyBaseUrl) {
        const proxied = await proxyRequest(this.proxyBaseUrl, {
          method: request.method,
          path: request.path,
          query: request.query,
          headers: request.headers,
          rawBody: request.rawBody,
        }, this.originalFetch!);

        this.registry.recordProxied(requestContext, proxied.response.status, resolution.nearMisses);
        if (this.recordProxiedResponses) {
          this.registry.recordProxyMock(requestContext, proxied.response);
        }

        return {
          kind: 'mocked',
          statusCode: proxied.response.status,
          statusMessage: proxied.statusText,
          headers: proxied.response.headers,
          body: proxied.response.body === null || proxied.response.body === undefined
            ? null
            : typeof proxied.response.body === 'string'
              ? proxied.response.body
              : JSON.stringify(proxied.response.body),
        };
      }

      if (this.onUnhandled === 'fail') {
        this.registry.recordUnmatched(requestContext, resolution.nearMisses);
        return {
          kind: 'error',
          error: createConnectionError(`MockIt blocked unhandled request: ${request.method} ${request.path}`),
        };
      }

      this.registry.recordUnmatched(requestContext, resolution.nearMisses);
      return {
        kind: 'passthrough',
        originalRequest,
        normalized,
        callback,
      };
    }

    this.registry.recordMatched(requestContext, mock, response);

    if (response.fault === 'connection-reset') {
      return {
        kind: 'error',
        error: createConnectionError('MockIt simulated fault: connection reset'),
      };
    }

    const delay = resolveDelay(response);
    if (delay !== undefined) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...lowercaseHeaders(renderResponseHeaders(response.headers, requestContext)),
    };

    if (response.fault === 'empty-response') {
      return {
        kind: 'mocked',
        statusCode: response.status,
        statusMessage: http.STATUS_CODES[response.status] || '',
        headers,
        body: null,
      };
    }

    const renderedBody = renderResponseBody(response, requestContext);
    return {
      kind: 'mocked',
      statusCode: response.status,
      statusMessage: http.STATUS_CODES[response.status] || '',
      headers,
      body: renderedBody === null || renderedBody === undefined
        ? null
        : typeof renderedBody === 'string'
          ? renderedBody
          : JSON.stringify(renderedBody),
    };
  }

  private resolveRequest(request: RequestResolutionData) {
    return this.registry.resolveDetailed(this.toRequestContext(request));
  }

  private toRequestContext(request: RequestResolutionData): RuntimeRequestContext {
    return {
      method: request.method,
      path: request.path,
      headers: request.headers,
      cookies: request.cookies,
      query: request.query,
      body: request.body,
    };
  }
}

type MockedNodeResult =
  | {
    kind: 'mocked';
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
    body: string | null;
  }
  | {
    kind: 'passthrough';
    originalRequest: PatchedRequest;
    normalized: NormalizedNodeRequest;
    callback?: RequestCallback;
  }
  | {
    kind: 'error';
    error: Error;
  };

class InterceptedClientRequest extends EventEmitter {
  private chunks: Buffer[] = [];
  private finished = false;
  private headers: Record<string, string>;
  private timeoutMs?: number;
  private timeoutCallback?: () => void;

  constructor(
    private normalized: NormalizedNodeRequest,
    private executor: (request: RequestResolutionData) => Promise<MockedNodeResult>,
    callback?: RequestCallback,
  ) {
    super();
    this.headers = { ...normalized.headers };
    if (callback) {
      this.on('response', callback);
    }
  }

  write(chunk: any, encoding?: BufferEncoding | ((error?: Error | null) => void), callback?: (error?: Error | null) => void): boolean {
    const cb = typeof encoding === 'function' ? encoding : callback;
    this.chunks.push(normalizeChunk(chunk, typeof encoding === 'string' ? encoding : undefined));
    cb?.(null);
    return true;
  }

  end(chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void): this {
    if (this.finished) return this;
    if (chunk !== undefined && chunk !== null) {
      this.chunks.push(normalizeChunk(chunk, typeof encoding === 'string' ? encoding : undefined));
    }
    this.finished = true;
    this.emit('finish');

    const cb = typeof encoding === 'function' ? encoding : callback;
    cb?.();

    queueMicrotask(() => {
      void this.execute();
    });
    return this;
  }

  abort(): this {
    const error = createConnectionError('socket hang up');
    this.emit('abort');
    this.emit('error', error);
    this.emit('close');
    return this;
  }

  destroy(error?: Error): this {
    if (error) {
      this.emit('error', error);
    }
    this.emit('close');
    return this;
  }

  setHeader(name: string, value: string | number | readonly string[]): void {
    this.headers[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  getHeader(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }

  removeHeader(name: string): void {
    delete this.headers[name.toLowerCase()];
  }

  setTimeout(ms: number, callback?: () => void): this {
    this.timeoutMs = ms;
    if (callback) {
      this.timeoutCallback = callback;
    }
    return this;
  }

  flushHeaders(): void {}

  setNoDelay(): this {
    return this;
  }

  setSocketKeepAlive(): this {
    return this;
  }

  private async execute(): Promise<void> {
    const rawBody = this.chunks.length > 0 ? Buffer.concat(this.chunks).toString('utf-8') : null;
    const request = toResolutionData(this.normalized, this.headers, rawBody);
    const result = await this.executor(request);

    if (result.kind === 'error') {
      this.emit('error', result.error);
      this.emit('close');
      return;
    }

    if (result.kind === 'passthrough') {
      this.forwardToNetwork(result.originalRequest, result.normalized, rawBody);
      return;
    }

    const response = createIncomingResponse(result.statusCode, result.statusMessage, result.headers, result.body);
    this.emit('response', response as import('node:http').IncomingMessage);

    if (this.timeoutMs !== undefined && this.timeoutCallback) {
      response.once('end', () => {
        this.timeoutCallback?.();
      });
    }

    this.emit('close');
  }

  private forwardToNetwork(originalRequest: PatchedRequest, normalized: NormalizedNodeRequest, rawBody: string | null): void {
    const req = originalRequest(normalized.url, {
      method: normalized.method,
      headers: this.headers,
    }, (res) => {
      this.emit('response', res);
    });

    if (this.timeoutMs !== undefined) {
      req.setTimeout(this.timeoutMs, () => {
        this.timeoutCallback?.();
      });
    }

    req.on('error', (error) => this.emit('error', error));
    req.on('timeout', () => this.emit('timeout'));
    req.on('abort', () => this.emit('abort'));
    req.on('close', () => this.emit('close'));

    if (shouldSendBody(normalized.method, rawBody)) {
      req.end(rawBody ?? undefined);
      return;
    }

    req.end();
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

function extractNodeRequestCallback(args: any[]): RequestCallback | undefined {
  return args.find((arg) => typeof arg === 'function');
}

function normalizeNodeRequestArgs(protocol: Protocol, args: any[]): NormalizedNodeRequest {
  const callbackless = args.filter((arg) => typeof arg !== 'function');
  const urlArg = callbackless.find((arg) => typeof arg === 'string' || arg instanceof URL) as string | URL | undefined;
  const options = callbackless.find((arg) => arg && typeof arg === 'object' && !(arg instanceof URL)) || {};

  const url = urlArg
    ? buildUrlFromInput(protocol, urlArg, options)
    : buildUrlFromOptions(protocol, options);

  return {
    protocol,
    url,
    method: (options.method || 'GET').toUpperCase(),
    headers: flattenNodeHeaders(options.headers),
  };
}

function buildUrlFromInput(protocol: Protocol, input: string | URL, options: any): URL {
  const url = input instanceof URL
    ? new URL(input.toString())
    : new URL(input, `${protocol}//localhost`);

  if (options.protocol) {
    url.protocol = options.protocol;
  }
  if (options.hostname) {
    url.hostname = options.hostname;
  } else if (typeof options.host === 'string' && options.host.length > 0) {
    const [hostname, port] = options.host.split(':');
    url.hostname = hostname;
    if (port) url.port = port;
  }
  if (options.port !== undefined) {
    url.port = String(options.port);
  }
  if (options.path) {
    const pathUrl = new URL(options.path, `${url.protocol}//${url.host}`);
    url.pathname = pathUrl.pathname;
    url.search = pathUrl.search;
  }

  return url;
}

function buildUrlFromOptions(protocol: Protocol, options: any): URL {
  const host = typeof options.host === 'string' && options.host.length > 0 ? options.host : undefined;
  const [hostNameFromHost, portFromHost] = host ? host.split(':') : [];
  const hostname = options.hostname || hostNameFromHost || 'localhost';
  const port = options.port ?? portFromHost;
  const path = options.path || '/';
  const portSegment = port ? `:${port}` : '';
  return new URL(path, `${options.protocol || protocol}//${hostname}${portSegment}`);
}

function flattenNodeHeaders(headers: any): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const flat: Record<string, string> = {};
    headers.forEach((value, key) => {
      flat[key.toLowerCase()] = value;
    });
    return flat;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value.join(', ') : String(value),
    ]),
  );
}

function toResolutionData(
  normalized: NormalizedNodeRequest,
  headers: Record<string, string>,
  rawBody: string | null,
): RequestResolutionData {
  const query: Record<string, string> = {};
  normalized.url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: any = rawBody;
  if (typeof rawBody === 'string' && rawBody.length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }
  }

  return {
    method: normalized.method,
    path: normalized.url.pathname,
    headers,
    cookies: parseCookies(headers.cookie),
    query,
    body,
    rawBody,
  };
}

function normalizeChunk(chunk: any, encoding?: BufferEncoding): Buffer {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (typeof chunk === 'string') return Buffer.from(chunk, encoding);
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  return Buffer.from(String(chunk), encoding);
}

function lowercaseHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function createIncomingResponse(
  statusCode: number,
  statusMessage: string,
  headers: Record<string, string>,
  body: string | null,
): PassThrough & Partial<import('node:http').IncomingMessage> {
  const stream = new PassThrough() as PassThrough & Partial<import('node:http').IncomingMessage>;
  stream.statusCode = statusCode;
  stream.statusMessage = statusMessage;
  stream.headers = headers;
  stream.rawHeaders = Object.entries(headers).flatMap(([key, value]) => [key, value]);
  queueMicrotask(() => {
    if (body !== null) {
      stream.end(body);
      return;
    }
    stream.end();
  });
  return stream;
}

function createConnectionError(message: string): Error & { code?: string } {
  const error = new Error(message) as Error & { code?: string };
  error.code = 'ECONNRESET';
  return error;
}

function shouldSendBody(method: string, rawBody: string | null): boolean {
  if (!rawBody) return false;
  const normalizedMethod = method.toUpperCase();
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD';
}
