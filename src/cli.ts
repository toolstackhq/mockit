#!/usr/bin/env node

import { helpText, runServe } from './cli/serve.js';

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(helpText());
    return;
  }

  if (command !== 'serve') {
    throw new Error(`Unknown command: ${command}\n\n${helpText()}`);
  }

  await runServe(args);
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
