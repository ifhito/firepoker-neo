import type { ProductBacklogItem } from './pbi';

export type SessionPhase = 'READY' | 'VOTING' | 'REVEAL' | 'FINALIZED';

export interface SessionParticipant {
  userId: string;
  displayName: string;
  joinedAt: string;
}

export interface SessionMeta {
  sessionId: string;
  title: string;
  facilitatorId: string;
  createdAt: string;
  pbiIds: string[];
}

export interface SessionState {
  meta: SessionMeta;
  phase: SessionPhase;
  votes: Record<string, number | null>;
  participants: SessionParticipant[];
  activePbiId: string | null;
}

export interface SessionRequestBody {
  title: string;
  facilitator: {
    id: string;
    name: string;
  };
  pbiIds: string[];
}

export interface SessionResponseBody {
  sessionId: string;
  joinToken: string;
  state: SessionState;
}

export interface FinalizeRequestBody {
  finalPoint: number;
  memo?: string | null;
}

export interface FinalizeResponseBody {
  finalPoint: number;
  notionPageId: string;
  updatedAt: string;
  pbi: ProductBacklogItem | null;
}
