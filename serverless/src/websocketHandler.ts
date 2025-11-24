import type { PBIStatus } from '@/domain/pbi';
import { getNotionClient, type NotionClient } from '@/server/notion/client';
import {
  createSessionAccessValidator,
  type ValidationFailureReason,
} from '@/server/session/access/validator';
import { createStructuredLogger, type StructuredLogger } from './observability';

type SessionAccessValidator = ReturnType<typeof createSessionAccessValidator>;
type HandlerLogger = Pick<typeof console, 'info' | 'error' | 'warn'>;

const PBI_STATUS_VALUES: PBIStatus[] = ['Backlog', 'Ready', 'InProgress', 'Done', 'Released'];

export type WebSocketEventType = 'CONNECT' | 'DISCONNECT' | 'MESSAGE';

export interface WebSocketRequestContext {
  eventType: WebSocketEventType;
  connectionId: string;
  domainName: string;
  stage: string;
  routeKey: string;
}

export interface WebSocketEvent {
  requestContext: WebSocketRequestContext;
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined> | null;
}

export interface WebSocketResponse {
  statusCode: number;
  body?: string;
}

export interface WebSocketResponder {
  send(connectionId: string, payload: unknown): Promise<void>;
  disconnect?(connectionId: string): Promise<void>;
}

export interface HandlerDependencies {
  notionClient: NotionClient;
  responder: WebSocketResponder;
  sessionValidator: SessionAccessValidator;
  telemetry: StructuredLogger;
  logger?: HandlerLogger;
}

const okResponse: WebSocketResponse = { statusCode: 200, body: 'OK' };
const connectedResponse: WebSocketResponse = { statusCode: 200, body: 'Connected' };
const disconnectedResponse: WebSocketResponse = { statusCode: 200, body: 'Disconnected' };

const parseBody = (raw: string | null | undefined): [null, unknown] | [Error] => {
  if (!raw) {
    return [null, {}];
  }

  try {
    return [null, JSON.parse(raw)];
  } catch {
    return [new Error('Invalid JSON payload')];
  }
};

const sendErrorPayload = async (
  responder: WebSocketResponder,
  connectionId: string,
  code: string,
  message: string,
) => {
  await responder.send(connectionId, { type: 'error', code, message });
};

const connectionFailureMessages: Record<ValidationFailureReason, string> = {
  MISSING_TOKEN: 'sessionId and joinToken are required to connect',
  INVALID_TOKEN: 'joinToken is invalid for the requested session',
  LIMIT_REACHED: 'Maximum concurrent connections reached for this session',
};

const extractConnectionParams = (event: WebSocketEvent) => ({
  sessionId: event.queryStringParameters?.sessionId ?? undefined,
  joinToken: event.queryStringParameters?.joinToken ?? undefined,
});

const handleConnect = async (event: WebSocketEvent, deps: HandlerDependencies) => {
  const params = extractConnectionParams(event);
  const decision = await deps.sessionValidator.validate(params);
  const telemetry = deps.telemetry;

  if (!decision.allowed) {
    await sendErrorPayload(
      deps.responder,
      event.requestContext.connectionId,
      decision.reason,
      connectionFailureMessages[decision.reason],
    );

    if (deps.responder.disconnect) {
      await deps.responder.disconnect(event.requestContext.connectionId);
    }

    telemetry.warn('CONNECT_DENIED', {
      connectionId: event.requestContext.connectionId,
      sessionId: params.sessionId,
      reason: decision.reason,
    });

    return { statusCode: decision.statusCode, body: 'Forbidden' };
  }

  telemetry.info('CONNECT', {
    connectionId: event.requestContext.connectionId,
    sessionId: decision.sessionId,
  });
  telemetry.metric('ConnectionsActive', decision.activeConnections);

  return connectedResponse;
};

const handleDisconnect = async (event: WebSocketEvent, deps: HandlerDependencies) => {
  const sessionId = event.queryStringParameters?.sessionId ?? undefined;
  const remaining = await deps.sessionValidator.release(sessionId);
  deps.telemetry.info('DISCONNECT', {
    connectionId: event.requestContext.connectionId,
    sessionId,
  });
  deps.telemetry.metric('ConnectionsActive', Math.max(remaining ?? 0, 0));
  return disconnectedResponse;
};

export const handleEvent = async (
  event: WebSocketEvent,
  deps: HandlerDependencies,
): Promise<WebSocketResponse> => {
  switch (event.requestContext.eventType) {
    case 'CONNECT':
      return handleConnect(event, deps);
    case 'DISCONNECT':
      return handleDisconnect(event, deps);
    case 'MESSAGE':
      return handleMessage(event, deps);
    default:
      deps.telemetry.warn('UNSUPPORTED_EVENT', {
        eventType: event.requestContext.eventType,
        connectionId: event.requestContext.connectionId,
      });
      await sendErrorPayload(
        deps.responder,
        event.requestContext.connectionId,
        'UNSUPPORTED_EVENT',
        `Unsupported event type: ${event.requestContext.eventType}`,
      );
      return okResponse;
  }
};

const handleMessage = async (
  event: WebSocketEvent,
  deps: HandlerDependencies,
): Promise<WebSocketResponse> => {
  const connectionId = event.requestContext.connectionId;
  const telemetry = deps.telemetry;
  const [error, body] = parseBody(event.body ?? null);

  if (error) {
    telemetry.warn('INVALID_JSON', { connectionId, error: error.message });
    await sendErrorPayload(deps.responder, connectionId, 'INVALID_JSON', error.message);
    return okResponse;
  }

  const payload = body as Record<string, unknown>;
  const action = payload.action;

  if (typeof action !== 'string') {
    await sendErrorPayload(deps.responder, connectionId, 'ACTION_REQUIRED', 'Action is required');
    return okResponse;
  }

  telemetry.info('MESSAGE_RECEIVED', {
    action,
    connectionId,
  });

  try {
    switch (action) {
      case 'listPbis':
        await handleListPbis(payload, deps, connectionId);
        break;
      case 'updateStoryPoint':
        await handleUpdateStoryPoint(payload, deps, connectionId);
        break;
      default:
        telemetry.warn('UNSUPPORTED_ACTION', { action, connectionId });
        await sendErrorPayload(
          deps.responder,
          connectionId,
          'UNSUPPORTED_ACTION',
          `Unsupported action: ${action}`,
        );
    }
  } catch (unknownError) {
    telemetry.error('MESSAGE_ERROR', {
      action,
      connectionId,
      error: unknownError instanceof Error ? unknownError.message : String(unknownError),
    });
    await sendErrorPayload(deps.responder, connectionId, 'UNEXPECTED_ERROR', 'Unexpected error occurred');
  }

  return okResponse;
};

const handleListPbis = async (
  payload: Record<string, unknown>,
  deps: HandlerDependencies,
  connectionId: string,
) => {
  const filters = parseListFilters(payload);
  if (!filters.ok) {
    await sendErrorPayload(deps.responder, connectionId, filters.code, filters.message);
    return;
  }

  try {
    const startedAt = Date.now();
    const items = await deps.notionClient.listPBIs(filters.value);
    await deps.responder.send(connectionId, {
      type: 'listPbisResult',
      items,
    });
    deps.telemetry.metric('ListPbisLatency', Date.now() - startedAt, undefined, 'Milliseconds');
    deps.telemetry.info('LIST_PBIS', {
      connectionId,
      filters: filters.value,
      itemCount: items.length,
    });
  } catch (error) {
    deps.telemetry.error('LIST_PBIS_ERROR', {
      connectionId,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendErrorPayload(
      deps.responder,
      connectionId,
      'LIST_PBIS_FAILED',
      'Failed to load PBIs from Notion',
    );
  }
};

const handleUpdateStoryPoint = async (
  payload: Record<string, unknown>,
  deps: HandlerDependencies,
  connectionId: string,
) => {
  const parsed = parseUpdatePayload(payload);
  if (!parsed.ok) {
    await sendErrorPayload(deps.responder, connectionId, parsed.code, parsed.message);
    return;
  }

  try {
    await deps.notionClient.updateStoryPoint(parsed.value.pbiId, parsed.value.point, parsed.value.memo);
    await deps.responder.send(connectionId, {
      type: 'updateStoryPointResult',
      pbiId: parsed.value.pbiId,
      point: parsed.value.point,
    });
    deps.telemetry.metric('StoryPointUpdates', 1);
    deps.telemetry.info('UPDATE_STORY_POINT', {
      connectionId,
      pbiId: parsed.value.pbiId,
    });
  } catch (error) {
    deps.telemetry.error('UPDATE_STORY_POINT_ERROR', {
      connectionId,
      pbiId: parsed.value.pbiId,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendErrorPayload(
      deps.responder,
      connectionId,
      'UPDATE_STORY_POINT_FAILED',
      'Failed to update story point in Notion',
    );
  }
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseListFilters = (payload: Record<string, unknown>): ValidationResult<{
  status?: string;
  search?: string;
  sprint?: string;
}> => {
  const status = normalizeOptionalString(payload.status);
  if (status && !PBI_STATUS_VALUES.includes(status as PBIStatus)) {
    return {
      ok: false,
      code: 'INVALID_FILTER',
      message: 'status must be Backlog, Ready, InProgress, Done, or Released',
    };
  }

  return {
    ok: true,
    value: {
      status: status as PBIStatus | undefined,
      search: normalizeOptionalString(payload.search),
      sprint: normalizeOptionalString(payload.sprint),
    },
  };
};

const parseUpdatePayload = (payload: Record<string, unknown>): ValidationResult<{
  pbiId: string;
  point: number;
  memo?: string;
}> => {
  const pbiId = normalizeOptionalString(payload.pbiId);
  const point = normalizePointValue(payload.point);
  if (!pbiId || point == null) {
    return {
      ok: false,
      code: 'INVALID_UPDATE_INPUT',
      message: 'pbiId and point are required to update story points',
    };
  }

  return {
    ok: true,
    value: {
      pbiId,
      point,
      memo: normalizeOptionalString(payload.memo),
    },
  };
};

const normalizePointValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const createDefaultResponder = (event: WebSocketEvent): WebSocketResponder => {
  const baseUrl =
    process.env.WS_CALLBACK_ENDPOINT ??
    `https://${event.requestContext.domainName}/${event.requestContext.stage}`;

  const fetchFn: typeof fetch | undefined = (globalThis as any).fetch;
  if (!fetchFn) {
    throw new Error('fetch is not available in the current environment');
  }

  return {
    async send(connectionId, payload) {
      const target = `${baseUrl}/@connections/${connectionId}`;
      const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

      await fetchFn(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });
    },
    async disconnect(connectionId) {
      const target = `${baseUrl}/@connections/${connectionId}`;
      await fetchFn(target, {
        method: 'DELETE',
      });
    },
  };
};

const createDefaultDependencies = (event: WebSocketEvent): HandlerDependencies => {
  const logger = console;
  return {
    notionClient: getNotionClient(),
    responder: createDefaultResponder(event),
    sessionValidator: createSessionAccessValidator(),
    telemetry: createStructuredLogger({
      logger,
      baseContext: {
        connectionId: event.requestContext.connectionId,
        stage: event.requestContext.stage,
      },
      defaultDimensions: { Stage: event.requestContext.stage },
    }),
    logger,
  };
};

export const handler = async (event: WebSocketEvent): Promise<WebSocketResponse> => {
  const deps = createDefaultDependencies(event);
  return handleEvent(event, deps);
};
