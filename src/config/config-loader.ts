import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DefaultMockConfig } from '../core/types.js';
import { MockDefinition } from '../core/mock-definition.js';
import { assertSerializableMatcher } from '../matchers/serializable-matcher.js';

export async function loadConfig(configPath: string): Promise<MockDefinition[]> {
  const absolutePath = resolve(configPath);
  const module = await importConfigModule(absolutePath);
  const configs: DefaultMockConfig[] = module.default || module;

  return configs.map(configToDefinition);
}

async function importConfigModule(absolutePath: string): Promise<any> {
  const extension = extname(absolutePath).toLowerCase();

  if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
    return import(pathToFileURL(absolutePath).href);
  }

  if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
    const tempPath = await transpileTypeScriptConfig(absolutePath);
    try {
      return await import(pathToFileURL(tempPath).href);
    } finally {
      await rm(tempPath, { force: true });
    }
  }

  return import(pathToFileURL(absolutePath).href);
}

async function transpileTypeScriptConfig(absolutePath: string): Promise<string> {
  const ts = await import('typescript');
  const source = await readFile(absolutePath, 'utf-8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      esModuleInterop: true,
    },
    fileName: absolutePath,
  });

  const tempPath = join(dirname(absolutePath), `.mockit-config-${randomUUID()}.mjs`);
  await writeFile(tempPath, result.outputText, 'utf-8');
  return tempPath;
}

function configToDefinition(config: DefaultMockConfig): MockDefinition {
  const def = new MockDefinition(config.path, 'default');

  if (config.method) {
    def.method = config.method;
  }

  if (config.matchers?.headers) {
    for (const [name, matcher] of Object.entries(config.matchers.headers)) {
      assertSerializableMatcher(matcher, 'config.matchers.headers');
      def.headerMatchers.set(name.toLowerCase(), matcher);
    }
  }

  if (config.matchers?.cookies) {
    for (const [name, matcher] of Object.entries(config.matchers.cookies)) {
      assertSerializableMatcher(matcher, 'config.matchers.cookies');
      def.cookieMatchers.set(name.toLowerCase(), matcher);
    }
  }

  if (config.matchers?.query) {
    for (const [name, matcher] of Object.entries(config.matchers.query)) {
      assertSerializableMatcher(matcher, 'config.matchers.query');
      def.queryMatchers.set(name, matcher);
    }
  }

  if (config.matchers?.body) {
    for (const bodyMatcher of config.matchers.body) {
      assertSerializableMatcher(bodyMatcher.matcher, 'config.matchers.body');
    }
    def.bodyMatchers.push(...config.matchers.body);
  }

  def.response = {
    status: config.response.status,
    headers: config.response.headers || {},
    body: config.response.body ?? null,
    delay: config.response.delay,
    delayRange: config.response.delayRange,
    template: config.response.template,
    fault: config.response.fault,
  };

  return def;
}
