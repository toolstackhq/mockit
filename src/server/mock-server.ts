import { createServer, type Server } from 'node:http';
import { MockIt } from '../core/mock-scope.js';
import { handleRequest } from './request-handler.js';
import type { MockServerOptions } from '../core/types.js';

export class MockServer extends MockIt {
  private server: Server | null = null;
  private port: number;
  private host: string;

  constructor(options: MockServerOptions = {}) {
    super();
    this.port = options.port || 0;
    this.host = options.host || '127.0.0.1';
  }

  async start(): Promise<{ port: number; host: string }> {
    if (this.server) throw new Error('Server is already running');

    this.server = createServer((req, res) => {
      handleRequest(req, res, this.registry).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal mock server error', message: String(err) }));
      });
    });

    return new Promise((resolve, reject) => {
      this.server!.on('error', reject);
      this.server!.listen(this.port, this.host, () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          this.host = addr.address;
        }
        resolve({ port: this.port, host: this.host });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        this.server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get address(): string {
    return `http://${this.host}:${this.port}`;
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
