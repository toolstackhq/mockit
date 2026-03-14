#!/usr/bin/env node

import { initHelpText, runInit } from './cli/init.js';
import { helpText, runServe } from './cli/serve.js';

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(rootHelpText());
    return;
  }

  if (command === 'serve') {
    await runServe(args);
    return;
  }

  if (command === 'init') {
    await runInit(args);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${rootHelpText()}`);
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});

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
