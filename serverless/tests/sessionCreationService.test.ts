import { beforeEach, describe, expect, it, vi } from 'vitest';

const putSessionMetadata = vi.fn();
const publishSessionAccess = vi.fn();

vi.mock('../src/sessionMetadataStore', () => ({
  putSessionMetadata: (...args: unknown[]) => putSessionMetadata(...args),
}));

vi.mock('@/server/session/access/publisher', () => ({
  publishSessionAccess: (...args: unknown[]) => publishSessionAccess(...args),
}));

describe('createSessionRecords', () => {
  const metadata = {
    sessionId: 'sess_1',
    title: 'Sprint',
    facilitatorId: 'host_1',
    facilitatorName: 'Alice',
    backlogSource: {},
    connectionCap: 10,
    publicViewEnabled: false,
    createdAt: '2025-01-01',
    expiresAt: 1234,
  } as const;

  beforeEach(() => {
    putSessionMetadata.mockReset();
    publishSessionAccess.mockReset();
  });

  it('stores metadata then publishes session access', async () => {
    const { createSessionRecords } = await import('../src/sessionCreationService');

    await createSessionRecords({ metadata, joinToken: 'join', maxConnections: 10 });

    expect(putSessionMetadata).toHaveBeenCalledWith(metadata);
    expect(publishSessionAccess).toHaveBeenCalledWith({
      sessionId: metadata.sessionId,
      joinToken: 'join',
      expiresAt: metadata.expiresAt,
      maxConnections: 10,
    });
  });

  it('throws when metadata storage fails', async () => {
    putSessionMetadata.mockRejectedValue(new Error('dynamo failed'));
    const { createSessionRecords } = await import('../src/sessionCreationService');

    await expect(
      createSessionRecords({ metadata, joinToken: 'join', maxConnections: 10 }),
    ).rejects.toThrow('Failed to store session metadata');
    expect(publishSessionAccess).not.toHaveBeenCalled();
  });

  it('throws when publishing session access fails', async () => {
    publishSessionAccess.mockRejectedValue(new Error('dynamo failed'));
    const { createSessionRecords } = await import('../src/sessionCreationService');

    await expect(
      createSessionRecords({ metadata, joinToken: 'join', maxConnections: 10 }),
    ).rejects.toThrow('Failed to publish session access');
    expect(putSessionMetadata).toHaveBeenCalled();
  });
});
