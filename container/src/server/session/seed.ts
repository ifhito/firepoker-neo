import type { SessionState } from '@/domain/session';
import { nowIsoString } from '@/server/utils/time';
import { upsertSession, getSessionRecord, SESSION_TTL_MS } from './store';
import { generateJoinToken } from '@/lib/ids';
import { publishSessionAccess } from './access/publisher';

const seedSessionId = 'sess_demo';

export const ensureDemoSession = async () => {
  const existing = await getSessionRecord(seedSessionId);
  if (existing) {
    return;
  }

  const state: SessionState = {
    meta: {
      sessionId: seedSessionId,
      title: 'デモセッション: 類似 PBI レビュー',
      facilitatorId: 'facilitator_demo',
      createdAt: nowIsoString(),
      pbiIds: [],
    },
    phase: 'VOTING',
    votes: {
      facilitator_demo: 5,
      member_1: null,
      member_2: 8,
    },
    participants: [
      {
        userId: 'facilitator_demo',
        displayName: 'Facilitator Demo',
        joinedAt: nowIsoString(),
      },
      {
        userId: 'member_1',
        displayName: 'Mika Sato',
        joinedAt: nowIsoString(),
      },
      {
        userId: 'member_2',
        displayName: 'Ren Ito',
        joinedAt: nowIsoString(),
      },
    ],
    activePbiId: null,
  };

  const joinToken = generateJoinToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;

  await upsertSession(seedSessionId, {
    state,
    joinToken,
    expiresAt,
  });

  await publishSessionAccess({
    sessionId: seedSessionId,
    joinToken,
    expiresAt,
  });
};
