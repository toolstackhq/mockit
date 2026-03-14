import { describe, it, expect, vi } from 'vitest';
import { resolve } from 'node:path';
import { buildDashboardUrl, helpText, parseServeArgs, runServe } from '../../src/cli/serve.js';

describe('CLI serve parser', () => {
  it('parses positional config paths', () => {
    const options = parseServeArgs(['./mock-config.ts']);
    expect(options.configPath).toBe(resolve('./mock-config.ts'));
    expect(options.swaggerPath).toBeUndefined();
    expect(options.port).toBe(3001);
    expect(options.host).toBe('127.0.0.1');
  });

  it('parses named flags', () => {
    const options = parseServeArgs([
      '--config', './mock-config.ts',
      '--swagger', './openapi.yaml',
      '--port', '4010',
      '--host', '0.0.0.0',
    ]);

    expect(options.configPath).toBe(resolve('./mock-config.ts'));
    expect(options.swaggerPath).toBe(resolve('./openapi.yaml'));
    expect(options.port).toBe(4010);
    expect(options.host).toBe('0.0.0.0');
  });

  it('supports swagger-only startup', () => {
    const options = parseServeArgs(['--swagger', './openapi.yaml']);
    expect(options.configPath).toBeUndefined();
    expect(options.swaggerPath).toBe(resolve('./openapi.yaml'));
  });

  it('rejects invalid ports and unknown args', () => {
    expect(() => parseServeArgs(['--port', 'abc'])).toThrow(/Invalid port/i);
    expect(() => parseServeArgs(['--wat'])).toThrow(/Unknown argument/i);
    expect(() => parseServeArgs(['--config'])).toThrow(/Missing value/i);
    expect(() => parseServeArgs(['--help'])).toThrow(/mockit serve/);
  });

  it('returns help text', () => {
    expect(helpText()).toContain('mockit serve');
    expect(helpText()).toContain('--swagger');
  });

  it('builds a dashboard url for local access', () => {
    expect(buildDashboardUrl('127.0.0.1', 3001)).toBe('http://127.0.0.1:3001/_mockit');
    expect(buildDashboardUrl('0.0.0.0', 3001)).toBe('http://127.0.0.1:3001/_mockit');
  });

  it('starts a server, loads sources, and logs startup urls', async () => {
    const loadDefaults = async () => {};
    const loadSwagger = async () => {};
    const start = async () => ({ host: '0.0.0.0', port: 4010 });
    const stop = vi.fn(async () => {});
    const logMessages: string[] = [];
    const signalHandlers = new Map<string, () => void>();

    await runServe([
      '--config', './mock-config.ts',
      '--swagger', './openapi.yaml',
      '--port', '4010',
      '--host', '0.0.0.0',
    ], {
      createServer: () => ({
        address: 'http://0.0.0.0:4010',
        loadDefaults,
        loadSwagger,
        start,
        stop,
      }),
      log: (message) => {
        logMessages.push(message);
      },
      onSignal: (signal, listener) => {
        signalHandlers.set(signal, listener);
      },
    });

    expect(logMessages).toContain('MockIt server running at http://0.0.0.0:4010');
    expect(logMessages).toContain('MockIt UI available at http://127.0.0.1:4010/_mockit');
    expect(logMessages.some((message) => message.includes('Loaded config:'))).toBe(true);
    expect(logMessages.some((message) => message.includes('Loaded swagger:'))).toBe(true);
    expect([...signalHandlers.keys()]).toEqual(['SIGINT', 'SIGTERM']);

    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    try {
      await signalHandlers.get('SIGINT')?.();
      expect(stop).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledWith(0);
    } finally {
      exit.mockRestore();
    }
  });

  it('uses the default serve deps with a real server', async () => {
    const listeners = new Map<string, () => void>();
    const processOn = vi.spyOn(process, 'on').mockImplementation(((signal: string, listener: () => void) => {
      listeners.set(signal, listener);
      return process;
    }) as any);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    try {
      await runServe(['--port', '0']);
      expect(log).toHaveBeenCalledWith(expect.stringContaining('MockIt server running at http://127.0.0.1:'));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('/_mockit'));
      await listeners.get('SIGINT')?.();
      expect(exit).toHaveBeenCalledWith(0);
    } finally {
      processOn.mockRestore();
      log.mockRestore();
      exit.mockRestore();
    }
  });
});
