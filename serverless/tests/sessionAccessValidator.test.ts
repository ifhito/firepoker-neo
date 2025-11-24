import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { SessionAccessStore } from '@/server/session/access/store';
import { createSessionAccessValidator } from '@/server/session/access/validator';
import { hashJoinToken } from '@/server/session/access/store';

const now = Date.now();
const baseRecord = {
  sessionId: 'sess_123',
  joinTokenHash: hashJoinToken('token-123'),
  maxConnections: 10,
  activeConnections: 0,
  expiresAt: now + 60_000,
};

type StoreMock = SessionAccessStore & {
  putSessionAccess: ReturnType<typeof vi.fn>;
  getSessionAccess: ReturnType<typeof vi.fn>;
  incrementActiveConnections: ReturnType<typeof vi.fn>;
  decrementActiveConnections: ReturnType<typeof vi.fn>;
};

const createStoreMock = (record: typeof baseRecord | null = baseRecord): StoreMock => ({
  putSessionAccess: vi.fn(),
  getSessionAccess: vi.fn().mockResolvedValue(record),
  incrementActiveConnections: vi.fn().mockResolvedValue({ allowed: true, activeConnections: 1 }),
  decrementActiveConnections: vi.fn().mockResolvedValue(0),
});

describe('SessionAccessValidator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  it('rejects when sessionId or joinToken is missing', async () => {
    const store = createStoreMock();
    const validator = createSessionAccessValidator({ store });

    await expect(
      validator.validate({ sessionId: undefined, joinToken: undefined })
    ).resolves.toEqual({ allowed: false, reason: 'MISSING_TOKEN', statusCode: 400 });
  });

  it('rejects when session access record is not found', async () => {
    const store = createStoreMock(null);
    const validator = createSessionAccessValidator({ store });

    const decision = await validator.validate({ sessionId: 'sess_404', joinToken: 'token-123' });
    expect(decision).toEqual({ allowed: false, reason: 'INVALID_TOKEN', statusCode: 401 });
  });

  it('rejects when join token hash does not match', async () => {
    const store = createStoreMock({ ...baseRecord, joinTokenHash: hashJoinToken('other') });
    const validator = createSessionAccessValidator({ store });

    const decision = await validator.validate({ sessionId: 'sess_123', joinToken: 'token-123' });
    expect(decision).toEqual({ allowed: false, reason: 'INVALID_TOKEN', statusCode: 401 });
  });

  it('rejects when active connection limit is reached', async () => {
    const store = createStoreMock(baseRecord);
    store.incrementActiveConnections.mockResolvedValue({ allowed: false, activeConnections: 10 });
    const validator = createSessionAccessValidator({ store });

    const decision = await validator.validate({ sessionId: 'sess_123', joinToken: 'token-123' });
    expect(decision).toEqual({ allowed: false, reason: 'LIMIT_REACHED', statusCode: 429 });
  });

  it('allows connection when token matches and capacity available', async () => {
    const store = createStoreMock(baseRecord);
    const validator = createSessionAccessValidator({ store });

    const decision = await validator.validate({ sessionId: 'sess_123', joinToken: 'token-123' });
    expect(decision).toEqual({ allowed: true, sessionId: 'sess_123', activeConnections: 1 });
    expect(store.incrementActiveConnections).toHaveBeenCalledWith('sess_123', baseRecord.maxConnections);
  });

  it('releases connection via store', async () => {
    const store = createStoreMock(baseRecord);
    const validator = createSessionAccessValidator({ store });

    const remaining = await validator.release('sess_123');
    expect(store.decrementActiveConnections).toHaveBeenCalledWith('sess_123');
    expect(remaining).toBe(0);
  });
});
