import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('nanoid', () => ({
  nanoid: () => 'abcd1234',
}));

describe('SessionCreationStore', () => {
  const fetchMock = vi.fn();
  const persistMock = vi.fn();

  const createStore = async () => {
    const module = await import('../web/src/sessionCreation/store');
    return module.createSessionCreationStore({
      endpoint: 'https://api.example.com',
      fetch: fetchMock as any,
      persistIdentity: persistMock,
      now: () => new Date('2025-01-01T00:00:00Z'),
    });
  };

  beforeEach(() => {
    fetchMock.mockReset();
    persistMock.mockReset();
  });

  it('validates required fields before submitting', async () => {
    const store = await createStore();
    store.updateField('title', '');
    store.updateField('facilitatorName', ' ');
    const result = await store.submit();
    expect(result.ok).toBe(false);
    expect(result.errors.title).toBeDefined();
    expect(result.errors.facilitatorName).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits data and stores identity on success', async () => {
    const store = await createStore();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'sess_123',
        joinToken: 'token_123',
        expiresAt: '2025-01-02T00:00:00.000Z',
      }),
    });

    store.updateField('title', ' Sprint ');
    store.updateField('facilitatorName', 'Alice');
    store.updateField('notionDbId', 'db123');
    store.updateField('connectionCap', 20);
    store.updateField('publicView', true);

    const result = await store.submit();

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse((options as { body: string }).body)).toEqual({
      title: 'Sprint',
      facilitator: { id: 'host_abcd1234', name: 'Alice' },
      connectionCap: 20,
      publicView: true,
      backlogSource: { notionDbId: 'db123' },
    });
    expect(persistMock).toHaveBeenCalledWith('sess_123', {
      userId: 'host_abcd1234',
      name: 'Alice',
      joinToken: 'token_123',
      dbId: 'db123',
    });
  });

  it('returns error when API fails', async () => {
    const store = await createStore();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 'ValidationError', message: 'Invalid title' }),
    });

    store.updateField('title', 'Sprint');
    store.updateField('facilitatorName', 'Alice');
    const result = await store.submit();

    expect(result.ok).toBe(false);
    expect(result.errors.global).toContain('Invalid title');
    expect(persistMock).not.toHaveBeenCalled();
  });
});
