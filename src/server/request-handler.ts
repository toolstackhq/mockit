import type { IncomingMessage, ServerResponse } from 'node:http';
import { MockRegistry } from '../core/mock-registry.js';
import { renderDashboard, mocksToJson } from './dashboard.js';
import {
  renderResponseBody,
  renderResponseHeaders,
  resolveDelay,
  type RuntimeRequestContext,
} from '../core/response-runtime.js';
import { proxyRequest } from '../shared/proxy.js';
import { createOverrideDefinition } from './override-api.js';

export interface RequestHandlerOptions {
  onUnhandled: 'fail' | 'proxy';
  proxyBaseUrl?: string;
  recordProxiedResponses?: boolean;
}

interface ParsedBody {
  parsed: any;
  rawText: string | null;
}

export async function parseRequestBody(req: IncomingMessage): Promise<any> {
  const body = await parseRequestBodyDetailed(req);
  return body.parsed;
}

export async function parseRequestBodyDetailed(req: IncomingMessage): Promise<ParsedBody> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({ parsed: null, rawText: null });
      try {
        resolve({ parsed: JSON.parse(raw), rawText: raw });
      } catch {
        resolve({ parsed: raw, rawText: raw });
      }
    });
    req.on('error', () => resolve({ parsed: null, rawText: null }));
  });
}

export function parseQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = new URLSearchParams(url.slice(idx + 1));
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

export function parsePath(url: string): string {
  const idx = url.indexOf('?');
  return idx === -1 ? url : url.slice(0, idx);
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  const result: Record<string, string> = {};
  const segments = cookieHeader.split(';');

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim().toLowerCase();
    const value = trimmed.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }

  return result;
}

export function flattenHeaders(rawHeaders: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value !== undefined) {
      result[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
    }
  }
  return result;
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  registry: MockRegistry,
  options: RequestHandlerOptions = { onUnhandled: 'fail' },
): Promise<void> {
  const url = req.url || '/';
  const path = parsePath(url);

  // Dashboard routes
  if (req.method === 'GET' && path === '/_mockit') {
    const html = renderDashboard(registry.listMocks());
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (req.method === 'GET' && path === '/_mockit/api/mocks') {
    const json = mocksToJson(registry.listMocks());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(json, null, 2));
    return;
  }

  if (req.method === 'GET' && path === '/_mockit/api/overrides') {
    const overrides = mocksToJson(registry.listMocks().filter((mock) => mock.priority === 'override'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(overrides, null, 2));
    return;
  }

  if (req.method === 'GET' && path === '/_mockit/api/requests') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(registry.listRequests(), null, 2));
    return;
  }

  if (req.method === 'GET' && path === '/_mockit/api/unmatched') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(registry.listUnmatchedRequests(), null, 2));
    return;
  }

  if (req.method === 'GET' && path === '/_mockit/api/pending') {
    const pending = mocksToJson(registry.pendingMocks());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(pending, null, 2));
    return;
  }

  if (req.method === 'DELETE' && path === '/_mockit/api/journal') {
    registry.clearJournal();
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedBody = await parseRequestBodyDetailed(req);

  if (req.method === 'POST' && path === '/_mockit/api/overrides') {
    try {
      const mock = createOverrideDefinition(parsedBody.parsed);
      registry.add(mock);

      const [serialized] = mocksToJson([mock]);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(serialized, null, 2));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Invalid override request',
        message: String(error instanceof Error ? error.message : error),
      }));
    }
    return;
  }

  if (req.method === 'DELETE' && path === '/_mockit/api/overrides') {
    registry.clear('override');
    res.writeHead(204);
    res.end();
    return;
  }

  const query = parseQuery(url);
  const headers = flattenHeaders(req.headers as Record<string, string | string[] | undefined>);
  const cookies = parseCookies(headers.cookie);
  const method = req.method || 'GET';

  const requestContext: RuntimeRequestContext = {
    method,
    path,
    headers,
    cookies,
    query,
    body: parsedBody.parsed,
  };
  const resolution = registry.resolveDetailed(requestContext);
  const mock = resolution.mock;
  const response = resolution.response;

  if (!mock || !response) {
    if (options.onUnhandled === 'proxy' && options.proxyBaseUrl) {
      const proxied = await proxyRequest(options.proxyBaseUrl, {
        method,
        path,
        query,
        headers,
        rawBody: parsedBody.rawText,
      });

      registry.recordProxied(requestContext, proxied.response.status, resolution.nearMisses);

      if (options.recordProxiedResponses) {
        registry.recordProxyMock(requestContext, proxied.response);
      }

      res.writeHead(proxied.response.status, proxied.response.headers);
      if (proxied.response.body !== null && proxied.response.body !== undefined) {
        res.end(
          typeof proxied.response.body === 'string'
            ? proxied.response.body
            : JSON.stringify(proxied.response.body),
        );
      } else {
        res.end();
      }
      return;
    }

    registry.recordUnmatched(requestContext, resolution.nearMisses);

    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'No mock matched',
      request: { method, path, query, cookies },
      nearMisses: resolution.nearMisses,
    }));
    return;
  }

  registry.recordMatched(requestContext, mock, response);

  if (response.fault === 'connection-reset') {
    res.destroy();
    return;
  }

  const delay = resolveDelay(response);
  if (delay !== undefined) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...renderResponseHeaders(response.headers, requestContext),
  };

  res.writeHead(response.status, responseHeaders);

  if (response.fault === 'empty-response') {
    res.end();
    return;
  }

  const renderedBody = renderResponseBody(response, requestContext);
  if (renderedBody !== null && renderedBody !== undefined) {
    const bodyStr = typeof renderedBody === 'string'
      ? renderedBody
      : JSON.stringify(renderedBody);
    res.end(bodyStr);
  } else {
    res.end();
  }
}
