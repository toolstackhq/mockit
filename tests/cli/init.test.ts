import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initHelpText, parseInitArgs, runInit } from '../../src/cli/init.js';

const tempDirs: string[] = [];

describe('CLI init', () => {
  afterEach(() => {
    tempDirs.length = 0;
  });

  it('parses default and custom output paths', () => {
    expect(parseInitArgs([]).outputPath).toBe(resolve('./mockit.config.ts'));
    expect(parseInitArgs(['./mocks/demo.ts']).outputPath).toBe(resolve('./mocks/demo.ts'));
    expect(parseInitArgs(['--output', './mocks/demo.ts']).outputPath).toBe(resolve('./mocks/demo.ts'));
  });

  it('parses force flag and help text', () => {
    expect(parseInitArgs(['--force']).force).toBe(true);
    expect(parseInitArgs(['--interactive']).mode).toBe('interactive');
    expect(parseInitArgs(['--default']).mode).toBe('default');
    expect(initHelpText()).toContain('mockit init');
    expect(() => parseInitArgs(['--wat'])).toThrow(/Unknown argument/i);
  });

  it('creates a starter config file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mockit-init-'));
    tempDirs.push(dir);
    const outputPath = join(dir, 'mockit.config.ts');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await runInit([outputPath]);

      const content = await readFile(outputPath, 'utf-8');
      expect(content).toContain("import { defineConfig, startsWith } from '@toolstackhq/mockit';");
      expect(content).toContain("path: '/api/users'");
      expect(content).toContain("path: '/api/login'");
      expect(logSpy).toHaveBeenCalledWith(`Created MockIt config: ${outputPath}`);
      expect(logSpy).toHaveBeenCalledWith(`Start it with: npx @toolstackhq/mockit serve --config ${outputPath}`);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('creates a guided config file from prompts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mockit-init-guided-'));
    tempDirs.push(dir);
    const outputPath = join(dir, 'mockit.config.ts');

    const answers = [
      '/api/balance',
      'GET',
      '200',
      '{"balance":200,"currency":"AUD"}',
      '{"content-type":"application/json"}',
      'y',
      '/api/login',
      'POST',
      '401',
      '{"message":"invalid username"}',
      '',
      'n',
    ];

    let closed = false;

    await runInit([outputPath, '--interactive'], () => ({
      async ask() {
        if (closed) {
          throw new Error('Prompt closed too early');
        }

        const answer = answers.shift();
        if (answer === undefined) {
          throw new Error('No answer left for prompt');
        }
        return answer;
      },
      close() {
        closed = true;
      },
    }));

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain("import { defineConfig } from '@toolstackhq/mockit';");
    expect(content).toContain('path: "/api/balance"');
    expect(content).toContain('method: "GET"');
    expect(content).toContain('"currency": "AUD"');
    expect(content).toContain('"content-type": "application/json"');
    expect(content).toContain('path: "/api/login"');
    expect(content).toContain('status: 401');
    expect(closed).toBe(true);
  });
});
