import { beforeEach, describe, expect, it, vi } from 'vitest';

const putMock = vi.fn();

describe('SessionMetadataStore', () => {
  beforeEach(() => {
    putMock.mockReset();
    process.env.SESSION_METADATA_TABLE_NAME = 'session_metadata';
  });

  it('writes metadata to DynamoDB with required fields', async () => {
    const { putSessionMetadata, setDocumentClientForTests } = await import('../src/sessionMetadataStore');
    setDocumentClientForTests({ put: (...args: unknown[]) => ({ promise: () => putMock(...args) }) } as any);
    await putSessionMetadata({
      sessionId: 'sess_1',
      title: 'Sprint',
      facilitatorId: 'host_1',
      facilitatorName: 'Alice',
      backlogSource: {},
      connectionCap: 10,
      publicViewEnabled: false,
      createdAt: '2025-01-01T00:00:00Z',
      expiresAt: 123,
    });

    expect(putMock).toHaveBeenCalledWith({
      TableName: 'session_metadata',
      Item: expect.objectContaining({ sessionId: 'sess_1' }),
    });
  });

  it('throws when table name is missing', async () => {
    delete process.env.SESSION_METADATA_TABLE_NAME;
    const { putSessionMetadata, setDocumentClientForTests } = await import('../src/sessionMetadataStore');
    setDocumentClientForTests({ put: (...args: unknown[]) => ({ promise: () => putMock(...args) }) } as any);

    await expect(
      putSessionMetadata({
        sessionId: 'sess_1',
        title: 'Sprint',
        facilitatorId: 'f',
        facilitatorName: 'n',
        backlogSource: {},
        connectionCap: 1,
        publicViewEnabled: false,
        createdAt: '2025-01-01',
        expiresAt: 1,
      }),
    ).rejects.toThrow('SESSION_METADATA_TABLE_NAME is not configured');
    expect(putMock).not.toHaveBeenCalled();
  });
});
