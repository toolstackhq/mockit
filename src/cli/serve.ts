import { resolve } from 'node:path';
import { MockServer } from '../server/mock-server.js';

export interface ServeOptions {
  configPath?: string;
  swaggerPath?: string;
  port: number;
  host: string;
}

export function parseServeArgs(args: string[]): ServeOptions {
  let configPath: string | undefined;
  let swaggerPath: string | undefined;
  let port = 3001;
  let host = '127.0.0.1';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    if (!arg.startsWith('--') && !configPath) {
      configPath = arg;
      continue;
    }

    switch (arg) {
      case '--config':
        configPath = requireValue(arg, args[++i]);
        break;
      case '--swagger':
        swaggerPath = requireValue(arg, args[++i]);
        break;
      case '--port':
        port = parsePort(requireValue(arg, args[++i]));
        break;
      case '--host':
        host = requireValue(arg, args[++i]);
        break;
      case '--help':
      case '-h':
        throw new Error(helpText());
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${helpText()}`);
    }
  }

  return {
    configPath: configPath ? resolve(configPath) : undefined,
    swaggerPath: swaggerPath ? resolve(swaggerPath) : undefined,
    port,
    host,
  };
}

export async function runServe(args: string[]): Promise<void> {
  const options = parseServeArgs(args);
  const server = new MockServer({ port: options.port, host: options.host });

  if (options.configPath) {
    await server.loadDefaults(options.configPath);
  }

  if (options.swaggerPath) {
    await server.loadSwagger(options.swaggerPath);
  }

  const address = await server.start();
  const serverUrl = `http://${address.host}:${address.port}`;
  const dashboardUrl = buildDashboardUrl(address.host, address.port);
  console.log(`MockIt server running at ${serverUrl}`);
  console.log(`MockIt UI available at ${dashboardUrl}`);
  if (options.configPath) {
    console.log(`Loaded config: ${options.configPath}`);
  }
  if (options.swaggerPath) {
    console.log(`Loaded swagger: ${options.swaggerPath}`);
  }

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export function helpText(): string {
  return [
    'Usage:',
    '  mockit serve [config-path] [--swagger ./openapi.yaml] [--port 3001] [--host 127.0.0.1]',
    '',
    'Examples:',
    '  mockit serve ./mock-config.ts',
    '  mockit serve --config ./mock-config.ts --swagger ./openapi.yaml --port 3001',
    '  mockit serve --swagger ./openapi.yaml --host 0.0.0.0 --port 3001',
  ].join('\n');
}

export function buildDashboardUrl(host: string, port: number): string {
  const browserHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  return `http://${browserHost}:${port}/_mockit`;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parsePort(raw: string): number {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port: ${raw}`);
  }
  return port;
}
