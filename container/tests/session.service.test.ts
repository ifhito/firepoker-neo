import { beforeEach, describe, expect, it } from 'vitest';
import {
  createSession,
  finalizeSession,
  getSessionState,
  getSessionStateAuthorized,
  selectActivePbi,
  registerParticipant,
  updateSessionPbis,
  delegateFacilitator,
} from '@/server/session/service';
import { clearSessions, updateSessionState } from '@/server/session/store';
import { HttpError } from '@/server/http/error';
import { findPbi } from '@/server/pbi/service';

describe('Session service', () => {
  beforeEach(async () => {
    await clearSessions();
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

  it('allows session creation without initial PBI selection', async () => {
    const response = await createSession({
      title: 'Empty Session',
      facilitator: { id: 'fac_002', name: 'Someone' },
      pbiIds: [],
    });

    expect(response.state.meta.pbiIds).toEqual([]);
    expect(response.state.activePbiId).toBeNull();
  });

  it('finalizes a session, updates Notion metadata, and returns info', async () => {
    const { sessionId } = await createSession({
      title: 'Finalize Demo',
      facilitator: { id: 'fac_003', name: 'Finalizer' },
      pbiIds: ['pbi_002'],
    });

    const result = await finalizeSession(sessionId, { finalPoint: 8, memo: 'Looks good' });
    expect(result).toMatchObject({
      finalPoint: 8,
      notionPageId: 'pbi_002',
    });

    const state = await getSessionState(sessionId);
    expect(state.phase).toBe('FINALIZED');

    const updatedPbi = await findPbi('pbi_002');
    expect(updatedPbi?.storyPoint).toBe(8);
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

    const state = await getSessionStateAuthorized(sessionId, joinToken);
    expect(state.meta.sessionId).toBe(sessionId);
    expect(state.participants[0]?.userId).toBe('fac_005');
  });

  it('throws when join token is invalid', async () => {
    const { sessionId } = await createSession({
      title: 'Invalid Token Test',
      facilitator: { id: 'fac_006', name: 'InvalidUser' },
      pbiIds: ['pbi_002'],
    });

    await expect(getSessionStateAuthorized(sessionId, 'invalid-token')).rejects.toBeInstanceOf(HttpError);
  });

  it('selects an active PBI, resets votes, and returns details', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Select Active PBI',
      facilitator: { id: 'fac_007', name: 'Selector' },
      pbiIds: ['pbi_001', 'pbi_002', 'pbi_003'],
    });

    await updateSessionState(sessionId, (state) => {
      state.votes = { fac_007: 5, user_x: 3 };
      state.phase = 'REVEAL';
    });

    const result = await selectActivePbi(sessionId, joinToken, 'pbi_003');

    expect(result.state.activePbiId).toBe('pbi_003');
    expect(result.state.votes).toEqual({});
    expect(result.state.phase).toBe('VOTING');
    expect(result.activePbi?.id).toBe('pbi_003');
    expect(Array.isArray(result.similar)).toBe(true);

    const updated = await getSessionState(sessionId);
    expect(updated.activePbiId).toBe('pbi_003');
    expect(updated.votes).toEqual({});
    expect(updated.phase).toBe('VOTING');
  });

  it('rejects selection when PBI is not part of session', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Invalid PBI selection',
      facilitator: { id: 'fac_008', name: 'Selector 2' },
      pbiIds: ['pbi_001'],
    });

    await expect(selectActivePbi(sessionId, joinToken, 'pbi_999')).rejects.toBeInstanceOf(HttpError);
  });

  it('registers a participant and ensures votes entry', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Participant Join',
      facilitator: { id: 'fac_009', name: 'Join Tester' },
      pbiIds: ['pbi_001'],
    });

    const state = await registerParticipant(sessionId, joinToken, {
      userId: 'user_new',
      displayName: 'Participant One',
    });

    const participant = state.participants.find((p) => p.userId === 'user_new');
    expect(participant?.displayName).toBe('Participant One');
    expect(state.votes.user_new).toBeNull();
  });

  it('does not duplicate participant entries', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Participant Duplicate',
      facilitator: { id: 'fac_010', name: 'Join Tester 2' },
      pbiIds: ['pbi_001'],
    });

    await registerParticipant(sessionId, joinToken, {
      userId: 'user_dup',
      displayName: 'Duplicate',
    });

    const state = await registerParticipant(sessionId, joinToken, {
      userId: 'user_dup',
      displayName: 'Duplicate',
    });

    const matches = state.participants.filter((p) => p.userId === 'user_dup');
    expect(matches).toHaveLength(1);
  });

  it('adds a new PBI to the session and returns details', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Add PBI',
      facilitator: { id: 'fac_011', name: 'Adder' },
      pbiIds: ['pbi_001'],
    });

    const result = await updateSessionPbis(sessionId, joinToken, 'add', 'pbi_002');
    expect(result.state.meta.pbiIds).toContain('pbi_002');
    expect(result.pbis.some((p) => p.id === 'pbi_002')).toBe(true);
  });

  it('removes a PBI from the session', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Remove PBI',
      facilitator: { id: 'fac_012', name: 'Remover' },
      pbiIds: ['pbi_001', 'pbi_002'],
    });

    const result = await updateSessionPbis(sessionId, joinToken, 'remove', 'pbi_002');
    expect(result.state.meta.pbiIds).not.toContain('pbi_002');
  });

  it('delegates facilitator role to another participant', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Delegate Host',
      facilitator: { id: 'fac_013', name: 'Original Host' },
      pbiIds: ['pbi_001'],
    });

    await registerParticipant(sessionId, joinToken, {
      userId: 'user_delegate',
      displayName: 'Next Host',
    });

    const state = await delegateFacilitator(sessionId, 'fac_013', 'user_delegate');

    expect(state.meta.facilitatorId).toBe('user_delegate');
    expect(state.participants.some((p) => p.userId === 'user_delegate')).toBe(true);
  });

  it('rejects delegation when actor is not current facilitator', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Invalid Delegation Actor',
      facilitator: { id: 'fac_014', name: 'Original Host' },
      pbiIds: ['pbi_001'],
    });

    await registerParticipant(sessionId, joinToken, {
      userId: 'user_delegate',
      displayName: 'Next Host',
    });

    await expect(delegateFacilitator(sessionId, 'user_delegate', 'fac_014')).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it('rejects delegation to non participant', async () => {
    const { sessionId } = await createSession({
      title: 'Delegate Non Participant',
      facilitator: { id: 'fac_015', name: 'Original Host' },
      pbiIds: ['pbi_001'],
    });

    await expect(delegateFacilitator(sessionId, 'fac_015', 'ghost_user')).rejects.toBeInstanceOf(
      HttpError,
    );
  });

});
