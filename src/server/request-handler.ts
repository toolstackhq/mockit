import type { IncomingMessage, ServerResponse } from 'node:http';
import { MockRegistry } from '../core/mock-registry.js';
import { renderDashboard, mocksToJson } from './dashboard.js';

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
  const method = req.method || 'GET';

  const mock = registry.resolve({ method, path, headers, query, body });

  if (!mock) {
    const available = registry.listMocks().map(m =>
      `  ${m.method || 'ANY'} ${m.path} [${m.priority}]`
    ).join('\n');

    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'No mock matched',
      request: { method, path, query },
      availableMocks: available || '(none)',
    }));
    return;
  }

  if (mock.response.delay) {
    await new Promise(resolve => setTimeout(resolve, mock.response.delay));
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...mock.response.headers,
  };

  res.writeHead(mock.response.status, responseHeaders);

  if (mock.response.body !== null && mock.response.body !== undefined) {
    const bodyStr = typeof mock.response.body === 'string'
      ? mock.response.body
      : JSON.stringify(mock.response.body);
    res.end(bodyStr);
  } else {
    res.end();
  }
}
