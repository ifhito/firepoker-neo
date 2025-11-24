import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/session/access/publisher', () => ({
  publishSessionAccess: vi.fn().mockResolvedValue(undefined),
}));

const { publishSessionAccess } = await import('@/server/session/access/publisher');
const publishSessionAccessMock = publishSessionAccess as ReturnType<typeof vi.fn>;

describe('Session access integration', () => {
  beforeEach(() => {
    publishSessionAccessMock.mockClear();
  });

  it('publishes session access when creating a session', async () => {
    const { createSession } = await import('@/server/session/service');
    const response = await createSession({
      title: 'Session Access Test',
      facilitator: { id: 'fac_x', name: 'Tester' },
      pbiIds: [],
    });

    expect(publishSessionAccessMock).toHaveBeenCalledWith({
      sessionId: response.sessionId,
      joinToken: response.joinToken,
      expiresAt: expect.any(Number),
    });
  });

  it('publishes access entry for demo session seed', async () => {
    const { clearSessions } = await import('@/server/session/store');
    await clearSessions();
    const { ensureDemoSession } = await import('@/server/session/seed');
    await ensureDemoSession();
    expect(publishSessionAccessMock).toHaveBeenCalledWith({
      sessionId: 'sess_demo',
      joinToken: expect.any(String),
      expiresAt: expect.any(Number),
    });
  });
});
