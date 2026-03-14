import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface InitOptions {
  outputPath: string;
  force: boolean;
}

export function parseInitArgs(args: string[]): InitOptions {
  let outputPath = './mockit.config.ts';
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!arg) continue;

    if (!arg.startsWith('--') && outputPath === './mockit.config.ts') {
      outputPath = arg;
      continue;
    }

    switch (arg) {
      case '--output':
      case '-o':
        outputPath = requireValue(arg, args[++i]);
        break;
      case '--force':
        force = true;
        break;
      case '--help':
      case '-h':
        throw new Error(initHelpText());
      default:
        throw new Error(`Unknown argument: ${arg}\n\n${initHelpText()}`);
    }
  }

  return {
    outputPath: resolve(outputPath),
    force,
  };
}

export async function runInit(args: string[]): Promise<void> {
  const options = parseInitArgs(args);

  if (existsSync(options.outputPath) && !options.force) {
    throw new Error(`File already exists: ${options.outputPath}\nUse --force to overwrite it.`);
  }

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, starterConfigTemplate(), 'utf-8');

  console.log(`Created MockIt config: ${options.outputPath}`);
  console.log(`Start it with: mockit serve --config ${options.outputPath}`);
}

export function initHelpText(): string {
  return [
    'Usage:',
    '  mockit init [output-path] [--force]',
    '',
    'Examples:',
    '  mockit init',
    '  mockit init ./mockit.config.ts',
    '  mockit init ./mocks/banking.ts --force',
  ].join('\n');
}

function starterConfigTemplate(): string {
  return `import { defineConfig, startsWith } from '@toolstackhq/mockit';

export default defineConfig([
  {
    path: '/api/users',
    method: 'GET',
    response: {
      status: 200,
      body: [
        { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
        { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
      ],
    },
  },
  {
    path: '/api/users/:id',
    method: 'GET',
    matchers: {
      headers: {
        authorization: startsWith('Bearer'),
      },
    },
    response: {
      status: 200,
      body: { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
    },
  },
  {
    path: '/api/login',
    method: 'POST',
    response: {
      status: 200,
      body: { message: 'logged in' },
    },
  },
]);
`;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}
