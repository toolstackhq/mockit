import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';

export interface DemoAppServer {
  url: string;
  stop(): Promise<void>;
}

export async function startDemoAppServer(mockBaseUrl: string): Promise<DemoAppServer> {
  const templatePath = new URL('../fixtures/demo-app.html', import.meta.url);
  const html = readFileSync(templatePath, 'utf-8');

  const server = createServer(async (req, res) => {
    const url = req.url || '/';

    if (url.startsWith('/api/')) {
      const target = new URL(url, mockBaseUrl);
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const response = await fetch(target, {
            method: req.method,
            headers: forwardHeaders(req.headers),
            body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
          });

          const body = Buffer.from(await response.arrayBuffer());
          const headers = Object.fromEntries(response.headers.entries());
          res.writeHead(response.status, headers);
          res.end(body);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise<void>((resolveStart, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveStart());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Unable to determine demo app server address');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    stop: () => closeServer(server),
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
}

function forwardHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    result[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  return result;
}
