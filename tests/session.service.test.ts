import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  finalizeSession,
  getSessionState,
  getSessionStateAuthorized,
} from '@/server/session/service';
import { clearSessions } from '@/server/session/store';
import { HttpError } from '@/server/http/error';

describe('Session service', () => {
  beforeEach(() => {
    clearSessions();
  });

  it('creates a session with facilitator as initial participant', async () => {
    const response = await createSession({
      title: 'API Gateway hardening',
      facilitator: { id: 'fac_001', name: 'Facilitator One' },
      pbiIds: ['pbi_002'],
    });

    expect(response.sessionId).toMatch(/^sess_/);
    expect(response.joinToken).toHaveLength(24);
    expect(response.state.meta.title).toBe('API Gateway hardening');
    expect(response.state.phase).toBe('READY');
    expect(response.state.participants).toHaveLength(1);
    expect(response.state.participants[0]).toMatchObject({
      userId: 'fac_001',
      displayName: 'Facilitator One',
    });
  });

  it('throws validation error when pbiIds is empty', async () => {
    await expect(
      createSession({
        title: 'Invalid Session',
        facilitator: { id: 'fac_002', name: 'Someone' },
        pbiIds: [],
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('finalizes a session and returns Notion metadata', async () => {
    const { sessionId } = await createSession({
      title: 'Finalize Demo',
      facilitator: { id: 'fac_003', name: 'Finalizer' },
      pbiIds: ['pbi_002'],
    });

    const result = await finalizeSession(sessionId, { finalPoint: 3, memo: 'Looks good' });
    expect(result).toMatchObject({
      finalPoint: 3,
      notionPageId: 'pbi_002',
    });

    const state = getSessionState(sessionId);
    expect(state.phase).toBe('FINALIZED');
  });

  it('rejects non Fibonacci story points when finalizing', async () => {
    const { sessionId } = await createSession({
      title: 'Invalid Fibonacci',
      facilitator: { id: 'fac_004', name: 'Tester' },
      pbiIds: ['pbi_002'],
    });

    await expect(finalizeSession(sessionId, { finalPoint: 4 })).rejects.toBeInstanceOf(HttpError);
  });

  it('retrieves session state when valid join token is provided', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Authorized Fetch',
      facilitator: { id: 'fac_005', name: 'Fetcher' },
      pbiIds: ['pbi_002'],
    });

    const state = getSessionStateAuthorized(sessionId, joinToken);
    expect(state.meta.sessionId).toBe(sessionId);
    expect(state.participants[0]?.userId).toBe('fac_005');
  });

  it('throws when join token is invalid', async () => {
    const { sessionId } = await createSession({
      title: 'Invalid Token Test',
      facilitator: { id: 'fac_006', name: 'InvalidUser' },
      pbiIds: ['pbi_002'],
    });

    expect(() => getSessionStateAuthorized(sessionId, 'invalid-token')).toThrow(HttpError);
  });
});
