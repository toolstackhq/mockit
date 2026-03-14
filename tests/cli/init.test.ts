import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
    expect(initHelpText()).toContain('mockit init');
    expect(() => parseInitArgs(['--wat'])).toThrow(/Unknown argument/i);
  });

  it('creates a starter config file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mockit-init-'));
    tempDirs.push(dir);
    const outputPath = join(dir, 'mockit.config.ts');

    await runInit([outputPath]);

    const content = await readFile(outputPath, 'utf-8');
    expect(content).toContain("import { defineConfig, startsWith } from '@toolstackhq/mockit';");
    expect(content).toContain("path: '/api/users'");
    expect(content).toContain("path: '/api/login'");
  });
});
