import { describe, expect, it } from 'vitest';

import { mapOutputsToEnv } from '../scripts/lib/terraformOutputs.js';

describe('mapOutputsToEnv', () => {
  it('creates deploy-ready environment variables from Terraform outputs', () => {
    const env = mapOutputsToEnv(
      {
        ws_endpoint: { value: 'wss://example.dev/prod' },
        rest_endpoint: { value: 'https://example.dev/rest' },
        static_site_domain: { value: 'd123.cloudfront.net' },
      },
      { stageName: 'prod' },
    );

    expect(env.NEXT_PUBLIC_WS_ENDPOINT).toBe('wss://example.dev/prod');
    expect(env.NEXT_PUBLIC_REST_ENDPOINT).toBe('https://example.dev/rest');
    expect(env.NEXT_PUBLIC_STAGE_NAME).toBe('prod');
    expect(env.NEXT_PUBLIC_STATIC_SITE_URL).toBe('https://d123.cloudfront.net');
  });

  it('falls back to existing defaults when outputs are missing', () => {
    const env = mapOutputsToEnv({}, { stageName: 'dev' });
    expect(env.NEXT_PUBLIC_WS_ENDPOINT).toBeUndefined();
    expect(env.NEXT_PUBLIC_REST_ENDPOINT).toBeUndefined();
    expect(env.NEXT_PUBLIC_STAGE_NAME).toBe('dev');
    expect(env.NEXT_PUBLIC_STATIC_SITE_URL).toBeUndefined();
  });
});
