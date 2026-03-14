import { describe, expect, it, vi } from 'vitest';
import { main, runCli } from '../../src/cli.js';

describe('CLI root', () => {
  it('prints help when no command is provided', async () => {
    const log = vi.fn();

    await runCli(['node', 'mockit'], {
      runServe: vi.fn(),
      runInit: vi.fn(),
      log,
      error: vi.fn(),
      exit: vi.fn(),
    });

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain('mockit <command>');
  });

  it('routes serve and init commands', async () => {
    const runServe = vi.fn();
    const runInit = vi.fn();

    await runCli(['node', 'mockit', 'serve', '--port', '4010'], {
      runServe,
      runInit,
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    });

    await runCli(['node', 'mockit', 'init', '--default'], {
      runServe,
      runInit,
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    });

    expect(runServe).toHaveBeenCalledWith(['--port', '4010']);
    expect(runInit).toHaveBeenCalledWith(['--default']);
  });

  it('throws for unknown commands', async () => {
    await expect(runCli(['node', 'mockit', 'wat'], {
      runServe: vi.fn(),
      runInit: vi.fn(),
      log: vi.fn(),
      error: vi.fn(),
      exit: vi.fn(),
    })).rejects.toThrow(/Unknown command/);
  });

  it('uses default deps for help output', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await runCli(['node', 'mockit']);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });

  it('reports failures through main', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    const originalArgv = process.argv;
    process.argv = ['node', 'mockit', 'wat'];

    try {
      await main();
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Unknown command: wat'));
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      process.argv = originalArgv;
      error.mockRestore();
      exit.mockRestore();
    }
  });
});
