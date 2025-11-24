import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/ids', () => ({
  generateSessionId: () => 'sess_mock',
  generateJoinToken: () => 'join_mock',
}));

const createSessionRecords = vi.fn();
const telemetryMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  metric: vi.fn(),
};

vi.mock('../src/sessionCreationService', () => ({
  createSessionRecords: (...args: unknown[]) => createSessionRecords(...args),
}));

vi.mock('../src/observability', () => ({
  createStructuredLogger: () => telemetryMock,
}));

describe('sessionCreationHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00Z'));
    createSessionRecords.mockReset();
    Object.values(telemetryMock).forEach((fn) => fn.mockReset());
    process.env.SESSION_ACCESS_MAX_CONNECTIONS = '10';
  });

  it('creates session metadata and publishes join token', async () => {
    const { handler } = await import('../src/sessionCreationHandler');
    const event = {
      body: JSON.stringify({
        title: ' Sprint Planning ',
        facilitator: { id: 'host_1', name: 'Alice' },
        backlogSource: { notionDbId: 'db123' },
        connectionCap: 15,
        publicView: true,
      }),
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body ?? '{}');
    expect(body).toMatchObject({
      sessionId: 'sess_mock',
      joinToken: 'join_mock',
      expiresAt: '2025-01-02T00:00:00.000Z',
    });
    expect(createSessionRecords).toHaveBeenCalledWith({
      metadata: expect.objectContaining({ sessionId: 'sess_mock', connectionCap: 15 }),
      joinToken: 'join_mock',
      maxConnections: 15,
    });
    expect(telemetryMock.info).toHaveBeenCalledWith('SESSION_CREATED', expect.any(Object));
    expect(telemetryMock.metric).toHaveBeenCalledWith('SessionsCreated', 1);
  });

  it('returns validation error for missing required fields', async () => {
    const { handler } = await import('../src/sessionCreationHandler');
    const event = {
      body: JSON.stringify({
        title: '',
        facilitator: { id: '', name: '' },
      }),
    } as any;

    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    const parsed = JSON.parse(response.body ?? '{}');
    expect(parsed.code).toBe('ValidationError');
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(createSessionRecords).not.toHaveBeenCalled();
    expect(telemetryMock.warn).toHaveBeenCalledWith('SESSION_CREATION_VALIDATION_FAILED', expect.any(Object));
  });

  it('handles malformed JSON', async () => {
    const { handler } = await import('../src/sessionCreationHandler');
    const response = await handler({ body: '<<invalid>>' } as any);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body ?? '{}').code).toBe('BadRequest');
    expect(telemetryMock.warn).toHaveBeenCalledWith('SESSION_CREATION_BAD_JSON', {});
  });
});
