import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getSessionRoute } from '../app/api/sessions/[sessionId]/route';
import { clearSessions } from '@/server/session/store';
import { createSession } from '@/server/session/service';

describe('GET /api/sessions/[sessionId]', () => {
  beforeEach(() => {
    clearSessions();
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
