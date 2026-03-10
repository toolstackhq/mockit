import type { MockResponse } from './types.js';

export interface RuntimeRequestContext {
  method: string;
  path: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  query: Record<string, string>;
  body: any;
}

export function resolveDelay(response: MockResponse): number | undefined {
  if (response.delay !== undefined) return response.delay;
  if (!response.delayRange) return undefined;

  const min = Math.min(response.delayRange.min, response.delayRange.max);
  const max = Math.max(response.delayRange.min, response.delayRange.max);
  if (min === max) return min;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function renderResponseBody(response: MockResponse, request: RuntimeRequestContext): any {
  if (!response.template) return response.body;
  return renderTemplateValue(response.body, request);
}

export function renderResponseHeaders(
  headers: Record<string, string>,
  request: RuntimeRequestContext,
): Record<string, string> {
  const rendered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    rendered[key] = String(renderTemplateValue(value, request));
  }
  return rendered;
}

function renderTemplateValue(value: any, request: RuntimeRequestContext): any {
  if (typeof value === 'string') {
    const exact = value.match(/^\s*\{\{\s*([^}]+)\s*\}\}\s*$/);
    if (exact) {
      const resolved = resolvePath(request, exact[1].trim());
      return resolved ?? '';
    }

    return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr) => {
      const resolved = resolvePath(request, String(expr).trim());
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map(v => renderTemplateValue(v, request));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = renderTemplateValue(v, request);
    }
    return result;
  }

  return value;
}

function resolvePath(request: RuntimeRequestContext, rawPath: string): any {
  const path = rawPath.startsWith('request.') ? rawPath.slice('request.'.length) : rawPath;
  if (!path) return undefined;

  const parts = path.split('.');
  let current: any = request;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}
