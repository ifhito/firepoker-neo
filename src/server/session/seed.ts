import type { SessionState } from '@/domain/session';
import { nowIsoString } from '@/server/utils/time';
import { upsertSession, getSessionRecord } from './store';
import { generateJoinToken } from '@/lib/ids';

const seedSessionId = 'sess_demo';

export const ensureDemoSession = () => {
  if (getSessionRecord(seedSessionId)) {
    return;
  }

  const state: SessionState = {
    meta: {
      sessionId: seedSessionId,
      title: 'デモセッション: 類似 PBI レビュー',
      facilitatorId: 'facilitator_demo',
      createdAt: nowIsoString(),
      pbiIds: ['pbi_001', 'pbi_002', 'pbi_004'],
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
    activePbiId: 'pbi_001',
  };

  upsertSession(seedSessionId, {
    state,
    joinToken: generateJoinToken(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24,
  });
};
