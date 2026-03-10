import type { MockDefinition } from '../core/mock-definition.js';

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  PATCH: '#a855f7',
  DELETE: '#ef4444',
  HEAD: '#6b7280',
  OPTIONS: '#6b7280',
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

function formatJson(value: any): string {
  if (value === null || value === undefined) return '<span class="null">null</span>';
  try {
    return escapeHtml(JSON.stringify(value, null, 2));
  } catch {
    return escapeHtml(String(value));
  }
}

function renderMatchers(mock: MockDefinition): string {
  const parts: string[] = [];

  for (const [name, matcher] of mock.headerMatchers) {
    parts.push(`<span class="matcher-label">header</span> <code>${escapeHtml(name)}</code> ${escapeHtml(matcher.name)}`);
  }
  for (const [name, matcher] of mock.cookieMatchers) {
    parts.push(`<span class="matcher-label">cookie</span> <code>${escapeHtml(name)}</code> ${escapeHtml(matcher.name)}`);
  }
  for (const [name, matcher] of mock.queryMatchers) {
    parts.push(`<span class="matcher-label">query</span> <code>${escapeHtml(name)}</code> ${escapeHtml(matcher.name)}`);
  }
  for (const { jsonPath, matcher } of mock.bodyMatchers) {
    parts.push(`<span class="matcher-label">body</span> <code>${escapeHtml(jsonPath)}</code> ${escapeHtml(matcher.name)}`);
  }

  if (parts.length === 0) return '';
  return `<div class="matchers">${parts.map(p => `<div class="matcher-row">${p}</div>`).join('')}</div>`;
}

function extractHintFromMatcher(matcherName: string): string {
  // Extract the value from matcher names like equals('test@bank.com'), startsWith('Bearer')
  const match = matcherName.match(/^\w+\('([^']*)'\)$/);
  if (match) return match[1];
  // For numeric: equals(42), greaterThan(10)
  const numMatch = matcherName.match(/^\w+\((\d+(?:\.\d+)?)\)$/);
  if (numMatch) return numMatch[1];
  return '';
}

function buildBodyFromMatchers(mock: MockDefinition): any {
  if (mock.bodyMatchers.length === 0) return null;

  const body: Record<string, any> = {};
  for (const { jsonPath, matcher } of mock.bodyMatchers) {
    // Extract field name from JSONPath like $.email, $.user.name, $.amount
    const fieldMatch = jsonPath.match(/^\$\.(.+)$/);
    if (!fieldMatch) continue;

    const hint = extractHintFromMatcher(matcher.name);
    const path = fieldMatch[1];

    // Handle nested paths like user.name
    const parts = path.split('.');
    let current: any = body;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    // Try to preserve numeric types
    const numVal = Number(hint);
    current[parts[parts.length - 1]] = hint !== '' && !isNaN(numVal) && !/[a-zA-Z@]/.test(hint) ? numVal : hint;
  }
  return body;
}

function buildHeadersFromMatchers(mock: MockDefinition): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, matcher] of mock.headerMatchers) {
    headers[name] = extractHintFromMatcher(matcher.name);
  }
  return headers;
}

function buildTryItData(mock: MockDefinition): string {
  const data: Record<string, any> = {
    method: mock.method || 'GET',
    path: mock.path,
    headers: buildHeadersFromMatchers(mock),
    body: null as any,
  };

  const bodyHint = buildBodyFromMatchers(mock);
  if (bodyHint) {
    data.body = bodyHint;
  } else if (['POST', 'PUT', 'PATCH'].includes(data.method)) {
    data.body = {};
  }

  return escapeAttr(JSON.stringify(data));
}

function renderMockCard(mock: MockDefinition, index: number): string {
  const method = mock.method || 'ANY';
  const color = METHOD_COLORS[method] || '#6b7280';
  const statusClass = mock.response.status >= 400 ? 'status-error' : 'status-ok';
  const tryId = `try-${index}`;

  return `
    <div class="mock-card">
      <div class="mock-header">
        <span class="method" style="background:${color}">${method}</span>
        <span class="path">${escapeHtml(mock.path)}</span>
        <span class="status ${statusClass}">${mock.response.status}</span>
        <span class="calls" id="calls-${index}">${mock.callCount} call${mock.callCount !== 1 ? 's' : ''}</span>
        <button class="try-btn" onclick="toggleTry('${tryId}')">Try it out</button>
      </div>
      ${renderMatchers(mock)}
      <div class="try-panel" id="${tryId}" data-mock="${buildTryItData(mock)}">
        <div class="try-form">
          <div class="try-row">
            <label>Path</label>
            <input type="text" class="try-input try-path" value="${escapeAttr(mock.path)}" />
          </div>
          <div class="try-row">
            <label>Headers</label>
            <textarea class="try-input try-headers" rows="3" placeholder='{"Authorization": "Bearer token"}'>${mock.headerMatchers.size > 0 ? escapeHtml(JSON.stringify(buildHeadersFromMatchers(mock), null, 2)) : ''}</textarea>
          </div>
          <div class="try-row try-body-row" ${['POST', 'PUT', 'PATCH'].includes(method) || mock.bodyMatchers.length > 0 ? '' : 'style="display:none"'}>
            <label>Body</label>
            <textarea class="try-input try-body" rows="4" placeholder='{"key": "value"}'>${(() => { const b = buildBodyFromMatchers(mock); return b ? escapeHtml(JSON.stringify(b, null, 2)) : ''; })()}</textarea>
          </div>
          <div class="try-actions">
            <button class="send-btn" onclick="sendRequest('${tryId}', '${method}')">Send</button>
            <button class="clear-btn" onclick="clearResponse('${tryId}')">Clear</button>
          </div>
        </div>
        <div class="try-response" id="${tryId}-response"></div>
      </div>
      ${mock.response.body !== null && mock.response.body !== undefined ? `
      <details>
        <summary>Response Body</summary>
        <pre class="body">${formatJson(mock.response.body)}</pre>
      </details>` : ''}
      ${Object.keys(mock.response.headers).length > 0 ? `
      <details>
        <summary>Response Headers</summary>
        <pre class="body">${formatJson(mock.response.headers)}</pre>
      </details>` : ''}
      ${mock.response.delay ? `<div class="delay">Delay: ${mock.response.delay}ms</div>` : ''}
    </div>`;
}

function renderGroup(title: string, badge: string, mocks: MockDefinition[], startIndex: number): string {
  if (mocks.length === 0) return '';
  return `
    <section class="group">
      <h2><span class="priority-badge ${badge}">${title}</span> <span class="count">${mocks.length}</span></h2>
      ${mocks.map((m, i) => renderMockCard(m, startIndex + i)).join('')}
    </section>`;
}

export function renderDashboard(mocks: MockDefinition[]): string {
  const overrides = mocks.filter(m => m.priority === 'override');
  const defaults = mocks.filter(m => m.priority === 'default');
  const swagger = mocks.filter(m => m.priority === 'swagger');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MockIt Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: ui-monospace, 'Cascadia Code', 'Fira Code', Menlo, monospace;
    background: #0a0a0a; color: #e5e5e5;
    padding: 2rem; max-width: 960px; margin: 0 auto;
    font-size: 14px; line-height: 1.6;
  }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; color: #fff; }
  .subtitle { color: #737373; margin-bottom: 2rem; font-size: 0.85rem; }
  .stats { display: flex; gap: 1.5rem; margin-bottom: 2rem; }
  .stat { color: #a3a3a3; }
  .stat strong { color: #fff; }
  h2 { font-size: 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
  .count { color: #737373; font-weight: normal; font-size: 0.85rem; }
  .group { margin-bottom: 2rem; }
  .priority-badge {
    padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .priority-override { background: #7c2d12; color: #fed7aa; }
  .priority-default { background: #1e3a5f; color: #93c5fd; }
  .priority-swagger { background: #14532d; color: #86efac; }
  .mock-card {
    border: 1px solid #262626; border-radius: 6px;
    padding: 0.75rem 1rem; margin-bottom: 0.5rem;
    background: #141414;
  }
  .mock-card:hover { border-color: #404040; }
  .mock-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .method {
    padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;
    font-weight: 700; color: #fff; min-width: 58px; text-align: center;
  }
  .path { color: #fff; font-weight: 500; }
  .status { margin-left: auto; font-weight: 600; }
  .status-ok { color: #22c55e; }
  .status-error { color: #ef4444; }
  .calls { color: #737373; font-size: 0.8rem; }
  .matchers { margin-top: 0.5rem; padding-left: 0.25rem; }
  .matcher-row { color: #a3a3a3; font-size: 0.8rem; margin-bottom: 2px; }
  .matcher-label {
    display: inline-block; padding: 1px 5px; border-radius: 3px;
    font-size: 0.7rem; background: #262626; color: #a3a3a3; margin-right: 4px;
  }
  .matcher-row code { color: #c084fc; }
  details { margin-top: 0.5rem; }
  summary { cursor: pointer; color: #737373; font-size: 0.8rem; }
  summary:hover { color: #a3a3a3; }
  pre.body {
    margin-top: 0.4rem; padding: 0.5rem 0.75rem;
    background: #0a0a0a; border: 1px solid #262626; border-radius: 4px;
    font-size: 0.8rem; overflow-x: auto; color: #a3a3a3;
  }
  .null { color: #737373; font-style: italic; }
  .delay { margin-top: 0.4rem; color: #f59e0b; font-size: 0.8rem; }
  .empty { color: #525252; padding: 2rem; text-align: center; }
  .refresh { color: #525252; font-size: 0.8rem; margin-top: 2rem; text-align: center; }
  .refresh a { color: #737373; }

  /* Try it out */
  .try-btn {
    padding: 2px 10px; border-radius: 4px; border: 1px solid #404040;
    background: transparent; color: #a3a3a3; font-size: 0.75rem;
    cursor: pointer; font-family: inherit;
  }
  .try-btn:hover { border-color: #737373; color: #fff; }
  .try-panel {
    display: none; margin-top: 0.75rem; padding: 0.75rem;
    border: 1px solid #262626; border-radius: 6px; background: #0d0d0d;
  }
  .try-panel.open { display: block; }
  .try-row { margin-bottom: 0.5rem; }
  .try-row label {
    display: block; font-size: 0.7rem; color: #737373;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 3px;
  }
  .try-input {
    width: 100%; padding: 6px 8px; border-radius: 4px;
    border: 1px solid #262626; background: #141414; color: #e5e5e5;
    font-family: inherit; font-size: 0.8rem; resize: vertical;
  }
  .try-input:focus { outline: none; border-color: #3b82f6; }
  .try-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .send-btn {
    padding: 5px 16px; border-radius: 4px; border: none;
    background: #3b82f6; color: #fff; font-size: 0.8rem;
    cursor: pointer; font-family: inherit; font-weight: 600;
  }
  .send-btn:hover { background: #2563eb; }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .clear-btn {
    padding: 5px 12px; border-radius: 4px; border: 1px solid #333;
    background: transparent; color: #737373; font-size: 0.8rem;
    cursor: pointer; font-family: inherit;
  }
  .clear-btn:hover { color: #a3a3a3; border-color: #555; }
  .try-response { margin-top: 0.75rem; }
  .try-response:empty { display: none; }
  .res-status {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem;
  }
  .res-ok { background: #14532d; color: #86efac; }
  .res-err { background: #7c2d12; color: #fed7aa; }
  .res-time { color: #525252; font-size: 0.75rem; margin-left: 0.5rem; }
  .res-headers-toggle {
    color: #525252; font-size: 0.75rem; cursor: pointer;
    margin-bottom: 0.4rem; display: block;
  }
  .res-headers-toggle:hover { color: #737373; }
  pre.res-body {
    padding: 0.5rem 0.75rem;
    background: #0a0a0a; border: 1px solid #262626; border-radius: 4px;
    font-size: 0.8rem; overflow-x: auto; color: #a3a3a3;
    white-space: pre-wrap; word-break: break-word;
  }
</style>
</head>
<body>
  <h1>MockIt Dashboard</h1>
  <p class="subtitle">Registered mock endpoints</p>
  <div class="stats">
    <span class="stat"><strong>${mocks.length}</strong> mocks</span>
    <span class="stat"><strong>${overrides.length}</strong> overrides</span>
    <span class="stat"><strong>${defaults.length}</strong> defaults</span>
    <span class="stat"><strong>${swagger.length}</strong> swagger</span>
  </div>
  ${mocks.length === 0 ? '<p class="empty">No mocks registered yet.</p>' : ''}
  ${renderGroup('Override', 'priority-override', overrides, 0)}
  ${renderGroup('Default', 'priority-default', defaults, overrides.length)}
  ${renderGroup('Swagger', 'priority-swagger', swagger, overrides.length + defaults.length)}
  <p class="refresh"><a href="/_mockit">Refresh</a> &middot; <a href="/_mockit/api/mocks">JSON API</a></p>

<script>
function toggleTry(id) {
  var panel = document.getElementById(id);
  panel.classList.toggle('open');
}

function clearResponse(id) {
  document.getElementById(id + '-response').innerHTML = '';
}

async function sendRequest(id, defaultMethod) {
  var panel = document.getElementById(id);
  var pathInput = panel.querySelector('.try-path');
  var headersInput = panel.querySelector('.try-headers');
  var bodyInput = panel.querySelector('.try-body');
  var sendBtn = panel.querySelector('.send-btn');

  var path = pathInput.value.trim();
  var method = defaultMethod === 'ANY' ? 'GET' : defaultMethod;

  // Parse headers
  var headers = {};
  var headersText = headersInput.value.trim();
  if (headersText) {
    try { headers = JSON.parse(headersText); }
    catch (e) {
      showError(id, 'Invalid headers JSON: ' + e.message);
      return;
    }
  }

  // Parse body
  var body = null;
  var bodyRow = panel.querySelector('.try-body-row');
  if (bodyRow && bodyRow.style.display !== 'none') {
    var bodyText = bodyInput.value.trim();
    if (bodyText) {
      try { JSON.parse(bodyText); body = bodyText; headers['Content-Type'] = headers['Content-Type'] || 'application/json'; }
      catch (e) {
        showError(id, 'Invalid body JSON: ' + e.message);
        return;
      }
    }
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  var start = performance.now();

  try {
    var opts = { method: method, headers: headers };
    if (body && method !== 'GET' && method !== 'HEAD') opts.body = body;
    var res = await fetch(path, opts);
    var elapsed = Math.round(performance.now() - start);

    var resText = await res.text();
    var formatted = resText;
    try { formatted = JSON.stringify(JSON.parse(resText), null, 2); } catch(e) {}

    var resHeaders = {};
    res.headers.forEach(function(v, k) { resHeaders[k] = v; });

    var statusClass = res.status < 400 ? 'res-ok' : 'res-err';
    var html = '<span class="res-status ' + statusClass + '">' + res.status + ' ' + res.statusText + '</span>';
    html += '<span class="res-time">' + elapsed + 'ms</span>';
    html += '<details class="res-headers-toggle"><summary>Response Headers</summary><pre class="res-body">' + escapeH(JSON.stringify(resHeaders, null, 2)) + '</pre></details>';
    html += '<pre class="res-body">' + escapeH(formatted) + '</pre>';

    document.getElementById(id + '-response').innerHTML = html;
  } catch (e) {
    showError(id, 'Request failed: ' + e.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
}

function showError(id, msg) {
  document.getElementById(id + '-response').innerHTML =
    '<span class="res-status res-err">Error</span> ' +
    '<pre class="res-body">' + escapeH(msg) + '</pre>';
}

function escapeH(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
</script>
</body>
</html>`;
}

export function mocksToJson(mocks: MockDefinition[]): object[] {
  return mocks.map(m => ({
    id: m.id,
    method: m.method || 'ANY',
    path: m.path,
    priority: m.priority,
    response: {
      status: m.response.status,
      headers: m.response.headers,
      body: m.response.body,
      delay: m.response.delay,
    },
    matchers: {
      headers: Object.fromEntries(
        [...m.headerMatchers.entries()].map(([k, v]) => [k, v.name])
      ),
      cookies: Object.fromEntries(
        [...m.cookieMatchers.entries()].map(([k, v]) => [k, v.name])
      ),
      query: Object.fromEntries(
        [...m.queryMatchers.entries()].map(([k, v]) => [k, v.name])
      ),
      body: m.bodyMatchers.map(b => ({ jsonPath: b.jsonPath, matcher: b.matcher.name })),
    },
    callCount: m.callCount,
  }));
}
