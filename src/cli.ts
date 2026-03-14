#!/usr/bin/env node

import { initHelpText, runInit } from './cli/init.js';
import { helpText, runServe } from './cli/serve.js';

export interface CliDeps {
  runServe: typeof runServe;
  runInit: typeof runInit;
  log: (message: string) => void;
  error: (message: string) => void;
  exit: (code: number) => void;
}

export async function runCli(argv: string[], deps: CliDeps = defaultCliDeps()): Promise<void> {
  const [, , command, ...args] = argv;

  if (!command || command === '--help' || command === '-h') {
    deps.log(rootHelpText());
    return;
  }

  if (command === 'serve') {
    await deps.runServe(args);
    return;
  }

  if (command === 'init') {
    await deps.runInit(args);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${rootHelpText()}`);
}

export async function main(): Promise<void> {
  try {
    await runCli(process.argv);
  } catch (error) {
    const deps = defaultCliDeps();
    deps.error(String(error instanceof Error ? error.message : error));
    deps.exit(1);
  }
}

function defaultCliDeps(): CliDeps {
  return {
    runServe,
    runInit,
    log: console.log,
    error: console.error,
    exit: process.exit,
  };
}

function rootHelpText(): string {
  return [
    'Usage:',
    '  mockit <command> [options]',
    '',
    'Commands:',
    '  serve   Start a standalone mock server',
    '  init    Create a starter TypeScript mock config',
    '',
    helpText(),
    '',
    initHelpText(),
  ].join('\n');
}

if (!(import.meta as ImportMeta & { vitest?: unknown }).vitest) {
  void main();
}
