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
import { findPbi, listSimilarPbis } from '@/server/pbi/service';
import { getNotionClient } from '@/server/notion/client';
import { ensureDemoSession } from './seed';

const FIBONACCI_VALUES = new Set([0, 1, 2, 3, 5, 8, 13, 21, 34]);

void ensureDemoSession();

export const createSession = async (body: SessionRequestBody): Promise<SessionResponseBody> => {
  const initialPbiIds = body.pbiIds ?? [];
  const sessionId = generateSessionId();
  const joinToken = generateJoinToken();
  const state: SessionState = {
    meta: {
      sessionId,
      title: body.title,
      facilitatorId: body.facilitator.id,
      createdAt: nowIsoString(),
      pbiIds: initialPbiIds,
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
    activePbiId: initialPbiIds[0] ?? null,
  };

  await upsertSession(sessionId, {
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

export const getSessionState = async (sessionId: string): Promise<SessionState> => {
  const record = await getSessionRecord(sessionId);
  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }
  return record.state;
};

export const getSessionStateAuthorized = async (
  sessionId: string,
  joinToken: string,
): Promise<SessionState> => {
  const record = await getSessionRecord(sessionId);
  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  if (record.joinToken !== joinToken) {
    throw new HttpError(401, 'Unauthorized', 'Invalid join token.');
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

  const record = await updateSessionState(sessionId, (state) => {
    state.phase = 'FINALIZED';
  });

  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  const notionClient = getNotionClient();
  const activePbiId = record.state.activePbiId;

  if (activePbiId) {
    await notionClient.updateStoryPoint(activePbiId, body.finalPoint, body.memo ?? null);
  }

  const notionPbi = activePbiId ? await findPbi(activePbiId) : null;

  return {
    finalPoint: body.finalPoint,
    notionPageId: notionPbi?.id ?? activePbiId ?? 'mock-page-id',
    updatedAt: nowIsoString(),
    pbi: notionPbi,
  };
};

export const selectActivePbi = async (
  sessionId: string,
  joinToken: string,
  pbiId: string,
) => {
  const record = await getSessionRecord(sessionId);
  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  if (record.joinToken !== joinToken) {
    throw new HttpError(401, 'Unauthorized', 'Invalid join token.');
  }

  if (!record.state.meta.pbiIds.includes(pbiId)) {
    throw new HttpError(400, 'ValidationError', 'Specified PBI is not part of this session.');
  }

  const updated = await updateSessionState(sessionId, (state) => {
    state.activePbiId = pbiId;
    state.phase = 'VOTING';
    state.votes = {};
  });

  if (!updated) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  const activePbi = await findPbi(pbiId);
  const similar = activePbi ? await listSimilarPbis(pbiId) : { items: [] };

  return {
    state: updated.state,
    activePbi,
    similar: similar.items,
  };
};

export const registerParticipant = async (
  sessionId: string,
  joinToken: string,
  participant: { userId: string; displayName: string },
) => {
  const record = await getSessionRecord(sessionId);
  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  if (record.joinToken !== joinToken) {
    throw new HttpError(401, 'Unauthorized', 'Invalid join token.');
  }

  const updated = await updateSessionState(sessionId, (state) => {
    if (!state.participants.some((p) => p.userId === participant.userId)) {
      state.participants.push({
        userId: participant.userId,
        displayName: participant.displayName,
        joinedAt: nowIsoString(),
      });
    }
    if (!(participant.userId in state.votes)) {
      state.votes[participant.userId] = null;
    }
  });

  if (!updated) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  return updated.state;
};

type UpdateSessionPbiAction = 'add' | 'remove';

export const updateSessionPbis = async (
  sessionId: string,
  joinToken: string,
  action: UpdateSessionPbiAction,
  pbiId: string,
) => {
  const record = await getSessionRecord(sessionId);
  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  if (record.joinToken !== joinToken) {
    throw new HttpError(401, 'Unauthorized', 'Invalid join token.');
  }

  const exists = record.state.meta.pbiIds.includes(pbiId);

  if (action === 'add') {
    if (exists) {
      throw new HttpError(409, 'Conflict', 'PBI is already part of the session.');
    }
    const pbi = await findPbi(pbiId);
    if (!pbi) {
      throw new HttpError(404, 'NotFound', 'PBI not found.');
    }
  } else if (action === 'remove' && !exists) {
    throw new HttpError(404, 'NotFound', 'PBI not part of the session.');
  }

  const updated = await updateSessionState(sessionId, (state) => {
    if (action === 'add') {
      state.meta.pbiIds.push(pbiId);
      if (!state.activePbiId) {
        state.activePbiId = pbiId;
      }
    } else {
      state.meta.pbiIds = state.meta.pbiIds.filter((id) => id !== pbiId);
      if (state.activePbiId === pbiId) {
        state.activePbiId = state.meta.pbiIds[0] ?? null;
        state.votes = {};
        state.phase = 'VOTING';
      }
    }
  });

  if (!updated) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  const activePbiId = updated.state.activePbiId;
  const activePbi = activePbiId ? await findPbi(activePbiId) : null;
  const similar = activePbi ? await listSimilarPbis(activePbi.id) : { items: [] };

  const detailedPbis = await Promise.all(
    updated.state.meta.pbiIds.map((id) => findPbi(id)),
  );

  return {
    state: updated.state,
    activePbi,
    similar: similar.items,
    pbis: detailedPbis.filter((item): item is NonNullable<typeof item> => Boolean(item)),
  };
};

export const delegateFacilitator = async (
  sessionId: string,
  actorId: string,
  delegateTo: string,
) => {
  const record = await getSessionRecord(sessionId);
  if (!record) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  if (record.state.meta.facilitatorId !== actorId) {
    throw new HttpError(403, 'Unauthorized', 'Only current facilitator can delegate.');
  }

  const targetExists = record.state.participants.some((participant) => participant.userId === delegateTo);
  if (!targetExists) {
    throw new HttpError(400, 'ValidationError', 'Delegate target must be a session participant.');
  }

  if (record.state.meta.facilitatorId === delegateTo) {
    return record.state;
  }

  const updated = await updateSessionState(sessionId, (state) => {
    state.meta.facilitatorId = delegateTo;
  });

  if (!updated) {
    throw new HttpError(404, 'NotFound', 'Session not found.');
  }

  return updated.state;
};
