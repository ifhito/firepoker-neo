import { describe, expect, it, beforeEach, vi } from 'vitest';
import { publishSessionAccess } from '@/server/session/access/publisher';
import { hashJoinToken, setSessionAccessStoreForTests } from '@/server/session/access/store';

const createStoreSpy = () => {
  const put = vi.fn();
  setSessionAccessStoreForTests({
    putSessionAccess: put,
    getSessionAccess: vi.fn(),
    incrementActiveConnections: vi.fn(),
    decrementActiveConnections: vi.fn().mockResolvedValue(0),
  });
  return put;
};

describe('publishSessionAccess', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    setSessionAccessStoreForTests(null);
  });

  it('stores hashed join token with default max connections', async () => {
    const put = createStoreSpy();

    await publishSessionAccess({ sessionId: 'sess_pub', joinToken: 'token-abc' });

    expect(put).toHaveBeenCalledWith({
      sessionId: 'sess_pub',
      joinTokenHash: hashJoinToken('token-abc'),
      maxConnections: 10,
      expiresAt: expect.any(Number),
    });
  });

  it('accepts overrides for expiresAt and maxConnections', async () => {
    const put = createStoreSpy();

    await publishSessionAccess({
      sessionId: 'sess_custom',
      joinToken: 'tok-custom',
      maxConnections: 5,
      expiresAt: 1704067200000,
    });

    expect(put).toHaveBeenCalledWith({
      sessionId: 'sess_custom',
      joinTokenHash: hashJoinToken('tok-custom'),
      maxConnections: 5,
      expiresAt: 1704067200000,
    });
  });
});
