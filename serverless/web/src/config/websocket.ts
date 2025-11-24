const DEFAULT_WS_ENDPOINT = 'ws://localhost:3001';
const DEFAULT_REST_ENDPOINT = 'http://localhost:3000';
const DEFAULT_STAGE_NAME = 'local';
const DEFAULT_SITE_URL = DEFAULT_REST_ENDPOINT;

export const resolveWebSocketEndpoint = (): string => {
  const configured = process.env.NEXT_PUBLIC_WS_ENDPOINT;
  return configured && configured.trim().length > 0 ? configured : DEFAULT_WS_ENDPOINT;
};

export const resolveRestEndpoint = (): string => {
  const configured = process.env.NEXT_PUBLIC_REST_ENDPOINT;
  return configured && configured.trim().length > 0 ? configured : DEFAULT_REST_ENDPOINT;
};

export const resolveDeploymentMetadata = (): { stageName: string; siteUrl: string } => {
  const stage = (process.env.NEXT_PUBLIC_STAGE_NAME ?? '').trim();
  const siteUrl = (process.env.NEXT_PUBLIC_STATIC_SITE_URL ?? '').trim();
  return {
    stageName: stage.length > 0 ? stage : DEFAULT_STAGE_NAME,
    siteUrl: siteUrl.length > 0 ? siteUrl : DEFAULT_SITE_URL,
  };
};
