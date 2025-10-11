import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getSessionRoute } from '../app/api/sessions/[sessionId]/route';
import { POST as postActivePbiRoute } from '../app/api/sessions/[sessionId]/active-pbi/route';
import { POST as postParticipantsRoute } from '../app/api/sessions/[sessionId]/participants/route';
import { POST as postPbisRoute } from '../app/api/sessions/[sessionId]/pbis/route';
import { clearSessions } from '@/server/session/store';
import { createSession } from '@/server/session/service';

describe('GET /api/sessions/[sessionId]', () => {
  beforeEach(async () => {
    await clearSessions();
  });

  it('returns session state when authorized', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Route Test',
      facilitator: { id: 'fac_r1', name: 'Route Tester' },
      pbiIds: ['pbi_002'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${joinToken}`,
      },
    });

    const response = await getSessionRoute(request, { params: { sessionId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta.sessionId).toBe(sessionId);
  });

  it('returns 401 when token is missing', async () => {
    const { sessionId } = await createSession({
      title: 'Route Unauthorized',
      facilitator: { id: 'fac_r2', name: 'Route Tester 2' },
      pbiIds: ['pbi_002'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}`);
    const response = await getSessionRoute(request, { params: { sessionId } });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe<'Unauthorized'>('Unauthorized');
  });

  it('returns 401 when token is invalid', async () => {
    const { sessionId } = await createSession({
      title: 'Route Invalid Token',
      facilitator: { id: 'fac_r3', name: 'Route Tester 3' },
      pbiIds: ['pbi_002'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}`, {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    const response = await getSessionRoute(request, { params: { sessionId } });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe<'Unauthorized'>('Unauthorized');
  });
});

describe('POST /api/sessions/[sessionId]/active-pbi', () => {
  beforeEach(async () => {
    await clearSessions();
  });

  it('updates the active PBI when authorized', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Route Select PBI',
      facilitator: { id: 'fac_r4', name: 'Route Selector' },
      pbiIds: ['pbi_001', 'pbi_002'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/active-pbi`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${joinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pbiId: 'pbi_002' }),
    });

    const response = await postActivePbiRoute(request, { params: { sessionId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activePbi.id).toBe('pbi_002');
  });

  it('rejects when PBI is not part of the session', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Route Invalid Selection',
      facilitator: { id: 'fac_r5', name: 'Route Selector 2' },
      pbiIds: ['pbi_001'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/active-pbi`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${joinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pbiId: 'pbi_999' }),
    });

    const response = await postActivePbiRoute(request, { params: { sessionId } });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe<'ValidationError'>('ValidationError');
  });
});

describe('POST /api/sessions/[sessionId]/participants', () => {
  beforeEach(async () => {
    await clearSessions();
  });

  it('registers participant when authorized', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Route Join Participant',
      facilitator: { id: 'fac_r6', name: 'Join Route' },
      pbiIds: ['pbi_001'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/participants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${joinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'user_join', displayName: 'Joiner' }),
    });

    const response = await postParticipantsRoute(request, { params: { sessionId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state.participants.some((p: any) => p.userId === 'user_join')).toBe(true);
  });

  it('returns 401 without authorization header', async () => {
    const { sessionId } = await createSession({
      title: 'Route Join Unauthorized',
      facilitator: { id: 'fac_r7', name: 'Join Route 2' },
      pbiIds: ['pbi_001'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/participants`, {
      method: 'POST',
      body: JSON.stringify({ userId: 'user_join', displayName: 'Joiner' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await postParticipantsRoute(request, { params: { sessionId } });
    expect(response.status).toBe(401);
  });
});

describe('POST /api/sessions/[sessionId]/pbis', () => {
  beforeEach(async () => {
    await clearSessions();
  });

  it('adds a PBI when authorized', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Route add PBI',
      facilitator: { id: 'fac_r8', name: 'Adder Route' },
      pbiIds: ['pbi_001'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/pbis`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${joinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'add', pbiId: 'pbi_002' }),
    });

    const response = await postPbisRoute(request, { params: { sessionId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state.meta.pbiIds).toContain('pbi_002');
  });

  it('rejects removal when PBI is not part of session', async () => {
    const { sessionId, joinToken } = await createSession({
      title: 'Route remove invalid',
      facilitator: { id: 'fac_r9', name: 'Remover Route' },
      pbiIds: ['pbi_001'],
    });

    const request = new Request(`http://localhost/api/sessions/${sessionId}/pbis`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${joinToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'remove', pbiId: 'pbi_999' }),
    });

    const response = await postPbisRoute(request, { params: { sessionId } });
    expect(response.status).toBe(404);
  });
});
