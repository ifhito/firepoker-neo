import { describe, expect, it, vi } from 'vitest';

import { createStructuredLogger } from '../src/observability';

describe('createStructuredLogger', () => {
  it('emits structured JSON logs with event metadata', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const structured = createStructuredLogger({ logger, baseContext: { stage: 'prod' } });

    structured.info('CONNECT', { connectionId: 'abc123' });

    expect(logger.info).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(logger.info.mock.calls[0][0]);
    expect(payload).toMatchObject({ eventType: 'CONNECT', stage: 'prod', connectionId: 'abc123', level: 'info' });
    expect(payload.timestamp).toBeGreaterThan(0);
  });

  it('logs embedded metrics when metric() is invoked', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const structured = createStructuredLogger({ logger, namespace: 'FirePocker/Serverless' });

    structured.metric('ConnectionsActive', 5, { Stage: 'prod' });

    const payload = JSON.parse(logger.info.mock.calls[0][0]);
    expect(payload).toMatchObject({
      Stage: 'prod',
      ConnectionsActive: 5,
      _aws: {
        CloudWatchMetrics: [
          {
            Namespace: 'FirePocker/Serverless',
            Dimensions: [['Stage']],
            Metrics: [{ Name: 'ConnectionsActive', Unit: 'Count' }],
          },
        ],
      },
    });
  });

  it('allows overriding the CloudWatch metric unit', () => {
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const structured = createStructuredLogger({ logger });

    structured.metric('ListPbisLatency', 120, { Stage: 'prod' }, 'Milliseconds');

    const payload = JSON.parse(logger.info.mock.calls[0][0]);
    expect(payload._aws.CloudWatchMetrics[0].Metrics[0].Unit).toBe('Milliseconds');
  });
});
