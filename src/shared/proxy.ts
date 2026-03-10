import type { MockResponse } from '../core/types.js';

export interface ProxyRequestData {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  rawBody: string | null;
}

export function buildProxyUrl(baseUrl: string, path: string, query: Record<string, string>): string {
  const url = new URL(path, ensureTrailingSlash(baseUrl));
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function proxyRequest(
  baseUrl: string,
  request: ProxyRequestData,
  fetchImpl: typeof fetch = fetch,
): Promise<{ response: MockResponse; statusText: string }> {
  const targetUrl = buildProxyUrl(baseUrl, request.path, request.query);
  const upstream = await fetchImpl(targetUrl, {
    method: request.method,
    headers: stripHopByHopHeaders(request.headers),
    body: shouldSendBody(request.method, request.rawBody) ? request.rawBody : undefined,
  });

  const headers = Object.fromEntries(upstream.headers.entries());
  const contentType = upstream.headers.get('content-type') || '';
  const rawText = await upstream.text();

  let body: any = rawText;
  if (!rawText) {
    body = null;
  } else if (contentType.includes('application/json')) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
  }

  return {
    response: {
      status: upstream.status,
      headers,
      body,
    },
    statusText: upstream.statusText,
  };
}

function ensureTrailingSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function shouldSendBody(method: string, rawBody: string | null): boolean {
  if (!rawBody) return false;
  const normalizedMethod = method.toUpperCase();
  return normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD';
}

function stripHopByHopHeaders(headers: Record<string, string>): Record<string, string> {
  const blocked = new Set([
    'host',
    'connection',
    'content-length',
    'transfer-encoding',
    'keep-alive',
    'upgrade',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
  ]);

  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase())),
  );
}
