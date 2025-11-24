import { ZodError } from 'zod';
import { generateJoinToken, generateSessionId } from '@/lib/ids';
import {
  DEFAULT_MAX_CONNECTIONS,
  SESSION_TTL_MS,
  sessionCreationRequestSchema,
} from '../web/src/contracts/sessionCreation';
import { type SessionMetadataRecord } from './sessionMetadataStore';
import { createStructuredLogger } from './observability';
import { createSessionRecords } from './sessionCreationService';

interface ApiGatewayHttpEvent {
  body: string | null;
  headers?: Record<string, string | undefined>;
}

interface ApiGatewayHttpResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const baseHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const respond = (statusCode: number, payload: unknown): ApiGatewayHttpResult => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify(payload),
});

const parseBody = (event: ApiGatewayHttpEvent): unknown => {
  if (!event.body) {
    return {};
  }
  return JSON.parse(event.body);
};

export const handler = async (event: ApiGatewayHttpEvent): Promise<ApiGatewayHttpResult> => {
  const telemetry = createStructuredLogger({
    baseContext: { handler: 'sessionCreationHandler' },
    defaultDimensions: { Stage: process.env.NEXT_PUBLIC_STAGE_NAME ?? 'unknown' },
  });
  try {
    const raw = parseBody(event);
    const body = sessionCreationRequestSchema.parse(raw);
    const sessionId = generateSessionId();
    const joinToken = generateJoinToken();
    const now = Date.now();
    const connectionCap = body.connectionCap ?? Number(process.env.SESSION_ACCESS_MAX_CONNECTIONS ?? DEFAULT_MAX_CONNECTIONS);
    const expiresAt = body.expiresAt ? Date.parse(body.expiresAt) : now + SESSION_TTL_MS;
    const metadata: SessionMetadataRecord = {
      sessionId,
      title: body.title,
      facilitatorId: body.facilitator.id,
      facilitatorName: body.facilitator.name,
      backlogSource: body.backlogSource ?? {},
      connectionCap,
      publicViewEnabled: body.publicView ?? false,
      createdAt: new Date(now).toISOString(),
      expiresAt,
    };

    await createSessionRecords({ metadata, joinToken, maxConnections: connectionCap });
    telemetry.info('SESSION_CREATED', { sessionId, connectionCap });
    telemetry.metric('SessionsCreated', 1);

    return respond(201, {
      sessionId,
      joinToken,
      expiresAt: new Date(expiresAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      telemetry.warn('SESSION_CREATION_BAD_JSON', {});
      return respond(400, { code: 'BadRequest', message: 'Invalid JSON payload' });
    }
    if (error instanceof ZodError) {
      telemetry.warn('SESSION_CREATION_VALIDATION_FAILED', { count: error.issues.length });
      return respond(400, {
        code: 'ValidationError',
        message: 'Session creation payload is invalid',
        issues: error.issues.map((issue) => ({ field: issue.path.join('.') || 'root', message: issue.message })),
      });
    }
    telemetry.error('SESSION_CREATION_FAILED', {
      message: error instanceof Error ? error.message : String(error),
    });
    telemetry.metric('SessionCreationErrors', 1);
    return respond(500, { code: 'InternalError', message: 'Failed to create session' });
  }
};
