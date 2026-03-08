import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DefaultMockConfig } from '../core/types.js';
import { MockDefinition } from '../core/mock-definition.js';

export async function loadConfig(configPath: string): Promise<MockDefinition[]> {
  const absolutePath = resolve(configPath);
  const fileUrl = pathToFileURL(absolutePath).href;

  const module = await import(fileUrl);
  const configs: DefaultMockConfig[] = module.default || module;

  return configs.map(configToDefinition);
}

function configToDefinition(config: DefaultMockConfig): MockDefinition {
  const def = new MockDefinition(config.path, 'default');

  if (config.method) {
    def.method = config.method;
  }

  if (config.matchers?.headers) {
    for (const [name, matcher] of Object.entries(config.matchers.headers)) {
      def.headerMatchers.set(name.toLowerCase(), matcher);
    }
  }

  if (config.matchers?.query) {
    for (const [name, matcher] of Object.entries(config.matchers.query)) {
      def.queryMatchers.set(name, matcher);
    }
  }

  if (config.matchers?.body) {
    def.bodyMatchers.push(...config.matchers.body);
  }

  def.response = {
    status: config.response.status,
    headers: config.response.headers || {},
    body: config.response.body ?? null,
  };

  return def;
}
