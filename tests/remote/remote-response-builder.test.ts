import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RemoteOverrideRequest } from '../../src/core/types.js';
import { RemoteResponseBuilder } from '../../src/remote/remote-response-builder.js';

const tempDirs: string[] = [];

describe('RemoteResponseBuilder', () => {
  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('builds remote overrides with all response helpers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mockit-remote-builder-'));
    tempDirs.push(dir);
    const bodyPath = join(dir, 'body.json');
    await writeFile(bodyPath, JSON.stringify({ from: 'file' }), 'utf-8');

    const createdRecords: RemoteOverrideRequest[] = [];
    const client = {
      async createOverride(request: RemoteOverrideRequest) {
        createdRecords.push(structuredClone(request));
        return { id: 'override-1', path: request.path, response: request.response };
      },
      async explainVerification() {
        return { totalCallCount: 1 };
      },
    } as any;

    const builder = new RemoteResponseBuilder(client, {
      path: '/api/orders',
      response: { status: 201 },
    });

    const finalBuilder = builder
      .withHeaders({ 'x-source': 'test' })
      .withBody({ ok: true })
      .withDelay(20)
      .withRandomDelay(10, 30)
      .withFault('empty-response')
      .withBodyTemplate({ message: 'Hello {{request.path}}' })
      .withBodyFromFile(bodyPath)
      .withStatus(202)
      .times(2)
      .optionally()
      .thenReply(429)
      .withBody({ retry: true })
      .replySequence(204);

    const record = await finalBuilder.apply();

    expect(record.id).toBe('override-1');

    const built = builder.build();
    expect(built.count).toBe(2);
    expect(built.optional).toBe(true);
    expect(built.response.status).toBe(202);
    expect(built.response.headers).toEqual({ 'x-source': 'test' });
    expect(built.response.body).toEqual({ from: 'file' });
    expect(built.response.delay).toBe(20);
    expect(built.response.delayRange).toEqual({ min: 10, max: 30 });
    expect(built.response.fault).toBe('empty-response');
    expect(built.response.template).toBe(true);
    expect(built.sequence?.map((item) => item.status)).toEqual([429, 204]);
    expect(createdRecords).toHaveLength(1);
    expect(await finalBuilder.isInvoked()).toBe(true);
  });

  it('supports once, persist, and false invocation before apply', async () => {
    const client = {
      async createOverride(request: RemoteOverrideRequest) {
        return { id: 'override-2', path: request.path, response: request.response };
      },
      async explainVerification() {
        return { totalCallCount: 0 };
      },
    } as any;

    const builder = new RemoteResponseBuilder(client, {
      path: '/api/users',
      response: { status: 200 },
    });

    expect(await builder.isInvoked()).toBe(false);

    builder.once();
    expect(builder.build().count).toBe(1);

    builder.persist();
    expect(builder.build().count).toBe(0);
  });
});
