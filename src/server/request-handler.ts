import type { IncomingMessage, ServerResponse } from 'node:http';
import { MockRegistry } from '../core/mock-registry.js';
import { renderDashboard, mocksToJson } from './dashboard.js';
import {
  renderResponseBody,
  renderResponseHeaders,
  resolveDelay,
  type RuntimeRequestContext,
} from '../core/response-runtime.js';

export async function parseRequestBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
    req.on('error', () => resolve(null));
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

  const body = await parseRequestBody(req);
  const query = parseQuery(url);
  const headers = flattenHeaders(req.headers as Record<string, string | string[] | undefined>);
  const cookies = parseCookies(headers.cookie);
  const method = req.method || 'GET';

  const requestContext: RuntimeRequestContext = { method, path, headers, cookies, query, body };
  const mock = registry.resolve(requestContext);

  if (!mock) {
    const available = registry.listMocks().map(m =>
      `  ${m.method || 'ANY'} ${m.path} [${m.priority}]`
    ).join('\n');

    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'No mock matched',
      request: { method, path, query, cookies },
      availableMocks: available || '(none)',
    }));
    return;
  }

  if (mock.response.fault === 'connection-reset') {
    res.destroy();
    return;
  }

  const delay = resolveDelay(mock.response);
  if (delay !== undefined) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...renderResponseHeaders(mock.response.headers, requestContext),
  };

  res.writeHead(mock.response.status, responseHeaders);

  if (mock.response.fault === 'empty-response') {
    res.end();
    return;
  }

  const renderedBody = renderResponseBody(mock.response, requestContext);
  if (renderedBody !== null && renderedBody !== undefined) {
    const bodyStr = typeof renderedBody === 'string'
      ? renderedBody
      : JSON.stringify(renderedBody);
    res.end(bodyStr);
  } else {
    res.end();
  }
}
