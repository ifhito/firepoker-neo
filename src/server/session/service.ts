import type {
  FinalizeRequestBody,
  FinalizeResponseBody,
  SessionRequestBody,
  SessionResponseBody,
  SessionState,
} from '@/domain/session';
import { generateJoinToken, generateSessionId } from '@/lib/ids';
import { nowIsoString } from '@/server/utils/time';
import { HttpError } from '@/server/http/error';
import { getSessionRecord, updateSessionState, upsertSession } from './store';
import { findPbi } from '@/server/pbi/service';
import { ensureDemoSession } from './seed';

const FIBONACCI_VALUES = new Set([0, 1, 2, 3, 5, 8, 13, 21, 34]);

ensureDemoSession();

export const createSession = async (body: SessionRequestBody): Promise<SessionResponseBody> => {
  if (body.pbiIds.length === 0) {
    throw new HttpError(400, 'ValidationError', 'pbiIds must contain at least one PBI.');
  }

  const sessionId = generateSessionId();
  const joinToken = generateJoinToken();
  const state: SessionState = {
    meta: {
      sessionId,
      title: body.title,
      facilitatorId: body.facilitator.id,
      createdAt: nowIsoString(),
      pbiIds: body.pbiIds,
    },
    phase: 'READY',
    votes: {},
    participants: [
      {
        userId: body.facilitator.id,
        displayName: body.facilitator.name,
        joinedAt: nowIsoString(),
      },
    ],
    activePbiId: body.pbiIds[0] ?? null,
  };

  upsertSession(sessionId, {
    state,
    joinToken,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });

  return {
    sessionId,
    joinToken,
    state,
  };
};

export const getSessionState = (sessionId: string): SessionState => {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }
  return record.state;
};

export const finalizeSession = async (
  sessionId: string,
  body: FinalizeRequestBody,
): Promise<FinalizeResponseBody> => {
  if (!FIBONACCI_VALUES.has(body.finalPoint)) {
    throw new HttpError(400, 'ValidationError', 'finalPoint must be a supported Fibonacci value.');
  }

  const record = updateSessionState(sessionId, (state) => {
    state.phase = 'FINALIZED';
  });

  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  const notionPbi = record.state.activePbiId ? await findPbi(record.state.activePbiId) : null;

  return {
    finalPoint: body.finalPoint,
    notionPageId: notionPbi?.id ?? 'mock-page-id',
    updatedAt: nowIsoString(),
    pbi: notionPbi,
  };
};
