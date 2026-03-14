import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { HttpMethod } from '../core/types.js';

export interface InitOptions {
  outputPath: string;
  force: boolean;
  mode: 'auto' | 'default' | 'interactive';
}

interface PromptAdapter {
  ask(question: string): Promise<string>;
  close(): void;
}

interface GuidedMockConfig {
  path: string;
  method: HttpMethod;
  status: number;
  body: any;
  headers?: Record<string, string>;
}

export function parseInitArgs(args: string[]): InitOptions {
  let outputPath = './mockit.config.ts';
  let force = false;
  let mode: InitOptions['mode'] = 'auto';

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
      case '--default':
        mode = 'default';
        break;
      case '--interactive':
      case '-i':
        mode = 'interactive';
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
    mode,
  };
}

export async function runInit(
  args: string[],
  promptFactory: () => PromptAdapter = createPromptAdapter,
): Promise<void> {
  const options = parseInitArgs(args);

  if (existsSync(options.outputPath) && !options.force) {
    throw new Error(`File already exists: ${options.outputPath}\nUse --force to overwrite it.`);
  }

  const content = await resolveInitTemplate(options, promptFactory);

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, content, 'utf-8');

  console.log(`Created MockIt config: ${options.outputPath}`);
  console.log(`Start it with: mockit serve --config ${options.outputPath}`);
}

export function initHelpText(): string {
  return [
    'Usage:',
    '  mockit init [output-path] [--force] [--default|--interactive]',
    '',
    'Examples:',
    '  mockit init',
    '  mockit init --interactive',
    '  mockit init ./mockit.config.ts',
    '  mockit init ./mocks/banking.ts --force',
  ].join('\n');
}

async function resolveInitTemplate(
  options: InitOptions,
  promptFactory: () => PromptAdapter,
): Promise<string> {
  if (options.mode === 'default') {
    return starterConfigTemplate();
  }

  if (options.mode === 'interactive' || (options.mode === 'auto' && input.isTTY && output.isTTY)) {
    const prompt = promptFactory();

    try {
      const choice = options.mode === 'interactive'
        ? 'guided'
        : await askMode(prompt);

      if (choice === 'starter') {
        return starterConfigTemplate();
      }

      return guidedConfigTemplate(prompt);
    } finally {
      prompt.close();
    }
  }

  return starterConfigTemplate();
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

async function guidedConfigTemplate(prompt: PromptAdapter): Promise<string> {
  const mocks: GuidedMockConfig[] = [];

  do {
    mocks.push(await promptForMock(prompt, mocks.length + 1));
  } while (await askYesNo(prompt, 'Add another endpoint?', false));

  return renderConfigTemplate(mocks);
}

async function askMode(prompt: PromptAdapter): Promise<'starter' | 'guided'> {
  while (true) {
    const answer = (await prompt.ask(
      'Create a starter config or answer a few questions? [starter/guided] (starter): ',
    )).trim().toLowerCase();

    if (!answer || answer === 'starter' || answer === 's') {
      return 'starter';
    }

    if (answer === 'guided' || answer === 'g') {
      return 'guided';
    }

    console.log('Enter "starter" or "guided".');
  }
}

async function promptForMock(prompt: PromptAdapter, index: number): Promise<GuidedMockConfig> {
  const path = await askRequired(prompt, `Endpoint path for mock ${index}`, defaultPath(index));
  const method = await askMethod(prompt, 'HTTP method', defaultMethod(index));
  const status = await askNumber(prompt, 'Response status', 200);
  const body = await askJson(prompt, 'Response body JSON', defaultBody(method));
  const headersInput = await prompt.ask('Response headers JSON (blank for none): ');
  const headers = headersInput.trim() ? parseJsonObject(headersInput, 'headers') : undefined;

  return {
    path,
    method,
    status,
    body,
    headers,
  };
}

async function askRequired(prompt: PromptAdapter, label: string, fallback: string): Promise<string> {
  while (true) {
    const answer = (await prompt.ask(`${label} (${fallback}): `)).trim();
    const value = answer || fallback;

    if (value) {
      return value.startsWith('/') ? value : `/${value}`;
    }
  }
}

async function askMethod(prompt: PromptAdapter, label: string, fallback: HttpMethod): Promise<HttpMethod> {
  while (true) {
    const answer = (await prompt.ask(
      `${label} [GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS] (${fallback}): `,
    )).trim().toUpperCase();
    const value = (answer || fallback) as HttpMethod;

    if (METHODS.includes(value)) {
      return value;
    }

    console.log(`Choose one of: ${METHODS.join(', ')}`);
  }
}

async function askNumber(prompt: PromptAdapter, label: string, fallback: number): Promise<number> {
  while (true) {
    const answer = (await prompt.ask(`${label} (${fallback}): `)).trim();

    if (!answer) {
      return fallback;
    }

    const value = Number(answer);
    if (Number.isInteger(value) && value >= 100 && value <= 599) {
      return value;
    }

    console.log('Enter a valid HTTP status code.');
  }
}

async function askJson(prompt: PromptAdapter, label: string, fallback: string): Promise<any> {
  while (true) {
    const answer = await prompt.ask(`${label} (${fallback}): `);
    const value = answer.trim() || fallback;

    try {
      return JSON.parse(value);
    } catch {
      console.log('Enter valid JSON, for example {"message":"ok"} or [{"id":1}].');
    }
  }
}

async function askYesNo(prompt: PromptAdapter, label: string, fallback: boolean): Promise<boolean> {
  while (true) {
    const answer = (await prompt.ask(`${label} [y/n] (${fallback ? 'y' : 'n'}): `)).trim().toLowerCase();

    if (!answer) {
      return fallback;
    }

    if (answer === 'y' || answer === 'yes') {
      return true;
    }

    if (answer === 'n' || answer === 'no') {
      return false;
    }

    console.log('Enter y or n.');
  }
}

function renderConfigTemplate(mocks: GuidedMockConfig[]): string {
  const entries = mocks.map((mock) => renderMockEntry(mock)).join(',\n');

  return `import { defineConfig } from '@toolstackhq/mockit';

export default defineConfig([
${entries}
]);
`;
}

function renderMockEntry(mock: GuidedMockConfig): string {
  const lines = [
    '  {',
    `    path: ${JSON.stringify(mock.path)},`,
    `    method: ${JSON.stringify(mock.method)},`,
    '    response: {',
    `      status: ${mock.status},`,
  ];

  if (mock.headers && Object.keys(mock.headers).length > 0) {
    lines.push(`      headers: ${formatValue(mock.headers, 3)},`);
  }

  lines.push(`      body: ${formatValue(mock.body, 3)},`);
  lines.push('    },');
  lines.push('  }');
  return lines.join('\n');
}

function formatValue(value: unknown, indentLevel: number): string {
  const serialized = JSON.stringify(value, null, 2);
  if (!serialized) {
    return 'null';
  }

  if (!serialized.includes('\n')) {
    return serialized;
  }

  const indent = '  '.repeat(indentLevel);
  return serialized
    .split('\n')
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join('\n');
}

function parseJsonObject(inputValue: string, label: string): Record<string, string> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(inputValue);
  } catch {
    throw new Error(`Invalid ${label} JSON. Use an object like {"content-type":"application/json"}.`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid ${label} JSON. Use an object like {"content-type":"application/json"}.`);
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => [key, String(value)]),
  );
}

function defaultPath(index: number): string {
  return index === 1 ? '/api/example' : `/api/example-${index}`;
}

function defaultMethod(index: number): HttpMethod {
  return index === 1 ? 'GET' : 'POST';
}

function defaultBody(method: HttpMethod): string {
  if (method === 'GET') {
    return '[{"id":1,"name":"Sample Item"}]';
  }

  return '{"message":"ok"}';
}

function createPromptAdapter(): PromptAdapter {
  const rl = createInterface({ input, output });

  return {
    ask(question: string) {
      return rl.question(question);
    },
    close() {
      rl.close();
    },
  };
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function requireValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}
