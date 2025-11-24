import { describe, expect, it, vi } from 'vitest';

import type { NotionClient } from '@/server/notion/client';
import { handleEvent, type HandlerDependencies } from '../src/websocketHandler';

type TestHandlerDependencies = HandlerDependencies & {
  responder: HandlerDependencies['responder'] & {
    disconnect: ReturnType<typeof vi.fn>;
  };
  sessionValidator: {
    validate: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
  telemetry: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    metric: ReturnType<typeof vi.fn>;
  };
};

const createDeps = (overrides?: Partial<TestHandlerDependencies>): TestHandlerDependencies => {
  const notionMock: NotionClient = {
    listPBIs: vi.fn(),
    findPBI: vi.fn(),
    listSimilarPbis: vi.fn(),
    listPbisByStoryPoints: vi.fn(),
    updateStoryPoint: vi.fn(),
  };

  const responder =
    overrides?.responder ??
    ({
      send: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
    } as unknown as HandlerDependencies['responder'] & { disconnect: ReturnType<typeof vi.fn> });

  const sessionValidator =
    (overrides as Partial<TestHandlerDependencies>)?.sessionValidator ?? {
      validate: vi.fn().mockResolvedValue({ allowed: true, sessionId: 'sess-123' }),
      release: vi.fn().mockResolvedValue(undefined),
    };

  return {
    notionClient: { ...notionMock, ...(overrides?.notionClient ?? {}) },
    responder,
    sessionValidator,
    telemetry:
      overrides?.telemetry ??
      ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        metric: vi.fn(),
      } as TestHandlerDependencies['telemetry']),
  };
};

const baseContext = {
  connectionId: 'abc123',
  domainName: 'example.com',
  stage: 'prod',
  routeKey: '$default',
};

const messageEvent = (body: unknown) => ({
  requestContext: {
    ...baseContext,
    eventType: 'MESSAGE' as const,
  },
  body: JSON.stringify(body),
});

describe('handleEvent', () => {
  it('routes listPbis action to Notion and sends the resulting items', async () => {
    const deps = createDeps();
    const items = [
      {
        id: 'pbi-1',
        title: 'Item 1',
        storyPoint: 5,
        status: 'Ready',
        assignee: null,
        epic: null,
        sprint: null,
        lastEstimatedAt: null,
      },
    ];
    (deps.notionClient.listPBIs as ReturnType<typeof vi.fn>).mockResolvedValue(items);

    const event = messageEvent({
      action: 'listPbis',
      status: 'Ready',
      search: 'fire',
    });

    const response = await handleEvent(event, deps);

    expect(deps.notionClient.listPBIs).toHaveBeenCalledWith({
      status: 'Ready',
      search: 'fire',
      sprint: undefined,
    });
    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'listPbisResult',
      items,
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });

  it('records latency metrics for listPbis operations', async () => {
    const deps = createDeps();
    (deps.notionClient.listPBIs as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await handleEvent(
      messageEvent({
        action: 'listPbis',
      }),
      deps,
    );

    expect(deps.telemetry.metric).toHaveBeenCalledWith('ListPbisLatency', expect.any(Number), undefined, 'Milliseconds');
  });

  it('updates story point via Notion and acknowledges the update', async () => {
    const deps = createDeps();
    const event = messageEvent({
      action: 'updateStoryPoint',
      pbiId: 'pbi-42',
      point: 3,
      memo: 'final estimate',
    });

    const response = await handleEvent(event, deps);

    expect(deps.notionClient.updateStoryPoint).toHaveBeenCalledWith('pbi-42', 3, 'final estimate');
    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'updateStoryPointResult',
      pbiId: 'pbi-42',
      point: 3,
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });

  it('increments StoryPointUpdates metrics after successful update', async () => {
    const deps = createDeps();

    await handleEvent(
      messageEvent({
        action: 'updateStoryPoint',
        pbiId: 'pbi-777',
        point: 5,
      }),
      deps,
    );

    expect(deps.telemetry.metric).toHaveBeenCalledWith('StoryPointUpdates', 1);
  });

  it('sends a validation error when the payload is not valid JSON', async () => {
    const deps = createDeps();
    const event = {
      requestContext: {
        ...baseContext,
        eventType: 'MESSAGE' as const,
      },
      body: '<<<invalid>>>',
    };

    const response = await handleEvent(event, deps);

    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'error',
      code: 'INVALID_JSON',
      message: 'Invalid JSON payload',
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });

  it('notifies the client when the action is not supported', async () => {
    const deps = createDeps();
    const event = messageEvent({
      action: 'UNKNOWN_ACTION',
    });

    const response = await handleEvent(event, deps);

    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'error',
      code: 'UNSUPPORTED_ACTION',
      message: 'Unsupported action: UNKNOWN_ACTION',
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });

  it('returns a simple acknowledgement for $connect events', async () => {
    const deps = createDeps();
    const event = {
      requestContext: {
        ...baseContext,
        eventType: 'CONNECT' as const,
      },
    };

    const response = await handleEvent(event, deps);

    expect(response).toEqual({ statusCode: 200, body: 'Connected' });
    expect(deps.responder.send).not.toHaveBeenCalled();
  });

  it('emits ConnectionsActive metrics on successful connect', async () => {
    const deps = createDeps({
      sessionValidator: {
        validate: vi.fn().mockResolvedValue({ allowed: true, sessionId: 'sess-200', activeConnections: 3 }),
        release: vi.fn(),
      },
    });
    const event = {
      requestContext: {
        ...baseContext,
        eventType: 'CONNECT' as const,
      },
      queryStringParameters: { sessionId: 'sess-200', joinToken: 'token-200' },
    };

    await handleEvent(event, deps);

    expect(deps.telemetry.metric).toHaveBeenCalledWith('ConnectionsActive', 3);
  });

  it('returns a simple acknowledgement for $disconnect events', async () => {
    const deps = createDeps();
    const event = {
      requestContext: {
        ...baseContext,
        eventType: 'DISCONNECT' as const,
      },
      queryStringParameters: { sessionId: 'sess-999' },
    };

    const response = await handleEvent(event, deps);

    expect(response).toEqual({ statusCode: 200, body: 'Disconnected' });
    expect(deps.responder.send).not.toHaveBeenCalled();
    expect(deps.sessionValidator.release).toHaveBeenCalledWith('sess-999');
  });

  it('validates access tokens during $connect events', async () => {
    const deps = createDeps();
    const event = {
      requestContext: {
        ...baseContext,
        eventType: 'CONNECT' as const,
      },
      queryStringParameters: { sessionId: 'sess-42', joinToken: 'token-42' },
    };

    const response = await handleEvent(event, deps);

    expect(deps.sessionValidator.validate).toHaveBeenCalledWith({
      sessionId: 'sess-42',
      joinToken: 'token-42',
    });
    expect(response).toEqual({ statusCode: 200, body: 'Connected' });
  });

  it('denies $connect requests when validation fails and disconnects the client', async () => {
    const deps = createDeps({
      sessionValidator: {
        validate: vi.fn().mockResolvedValue({
          allowed: false,
          reason: 'INVALID_TOKEN',
          statusCode: 401,
        }),
        release: vi.fn(),
      },
    });
    const event = {
      requestContext: {
        ...baseContext,
        eventType: 'CONNECT' as const,
      },
      queryStringParameters: { sessionId: 'sess-1', joinToken: 'bad-token' },
    };

    const response = await handleEvent(event, deps);

    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'error',
      code: 'INVALID_TOKEN',
      message: 'joinToken is invalid for the requested session',
    });
    expect(deps.responder.disconnect).toHaveBeenCalledWith('abc123');
    expect(response).toEqual({ statusCode: 401, body: 'Forbidden' });
  });

  it('rejects listPbis calls that include unsupported status filters', async () => {
    const deps = createDeps();
    const event = messageEvent({
      action: 'listPbis',
      status: 'InvalidStatus',
    });

    const response = await handleEvent(event, deps);

    expect(deps.notionClient.listPBIs).not.toHaveBeenCalled();
    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'error',
      code: 'INVALID_FILTER',
      message: 'status must be Backlog, Ready, InProgress, Done, or Released',
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });

  it('reports listPbis errors when the Notion client fails', async () => {
    const deps = createDeps();
    (deps.notionClient.listPBIs as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const event = messageEvent({
      action: 'listPbis',
    });

    const response = await handleEvent(event, deps);

    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'error',
      code: 'LIST_PBIS_FAILED',
      message: 'Failed to load PBIs from Notion',
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });

  it('rejects updateStoryPoint payloads that miss required fields', async () => {
    const deps = createDeps();
    const event = messageEvent({
      action: 'updateStoryPoint',
      pbiId: '',
      point: 'not-a-number',
    });

    const response = await handleEvent(event, deps);

    expect(deps.notionClient.updateStoryPoint).not.toHaveBeenCalled();
    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'error',
      code: 'INVALID_UPDATE_INPUT',
      message: 'pbiId and point are required to update story points',
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });

  it('sends an error when Notion updateStoryPoint fails', async () => {
    const deps = createDeps();
    (deps.notionClient.updateStoryPoint as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('nope'));
    const event = messageEvent({
      action: 'updateStoryPoint',
      pbiId: 'pbi-007',
      point: 8,
    });

    const response = await handleEvent(event, deps);

    expect(deps.responder.send).toHaveBeenCalledWith('abc123', {
      type: 'error',
      code: 'UPDATE_STORY_POINT_FAILED',
      message: 'Failed to update story point in Notion',
    });
    expect(response).toEqual({ statusCode: 200, body: 'OK' });
  });
});
