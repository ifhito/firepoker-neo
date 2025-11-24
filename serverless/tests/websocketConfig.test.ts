import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resetEnv = () => {
  delete process.env.NEXT_PUBLIC_WS_ENDPOINT;
  delete process.env.NEXT_PUBLIC_REST_ENDPOINT;
  delete process.env.NEXT_PUBLIC_STAGE_NAME;
  delete process.env.NEXT_PUBLIC_STATIC_SITE_URL;
};

describe('runtime configuration helpers', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns the configured public WebSocket endpoint when set', async () => {
    process.env.NEXT_PUBLIC_WS_ENDPOINT = 'wss://example.com/prod';
    const { resolveWebSocketEndpoint } = await import('../web/src/config/websocket');

    expect(resolveWebSocketEndpoint()).toBe('wss://example.com/prod');
  });

  it('falls back to a local development endpoint when not configured', async () => {
    const { resolveWebSocketEndpoint } = await import('../web/src/config/websocket');

    expect(resolveWebSocketEndpoint()).toBe('ws://localhost:3001');
  });

  it('resolves REST endpoint with environment override', async () => {
    process.env.NEXT_PUBLIC_REST_ENDPOINT = 'https://example.com/rest';
    const { resolveRestEndpoint } = await import('../web/src/config/websocket');

    expect(resolveRestEndpoint()).toBe('https://example.com/rest');
  });

  it('falls back to localhost REST endpoint when unset', async () => {
    const { resolveRestEndpoint } = await import('../web/src/config/websocket');

    expect(resolveRestEndpoint()).toBe('http://localhost:3000');
  });

  it('exposes deployment metadata for stage and CloudFront domain', async () => {
    process.env.NEXT_PUBLIC_STAGE_NAME = 'staging';
    process.env.NEXT_PUBLIC_STATIC_SITE_URL = 'https://d1.cloudfront.net';
    const { resolveDeploymentMetadata } = await import('../web/src/config/websocket');

    expect(resolveDeploymentMetadata()).toEqual({
      stageName: 'staging',
      siteUrl: 'https://d1.cloudfront.net',
    });
  });

  it('provides sensible defaults for deployment metadata', async () => {
    const { resolveDeploymentMetadata } = await import('../web/src/config/websocket');

    expect(resolveDeploymentMetadata()).toEqual({
      stageName: 'local',
      siteUrl: 'http://localhost:3000',
    });
  });
});
