const { existsSync, readFileSync } = require('node:fs');

const readTerraformOutputs = (filePath) => {
  if (!existsSync(filePath)) {
    return {};
  }
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const mapOutputsToEnv = (outputs, options = {}) => {
  const env = {};
  const wsEndpoint = outputs.ws_endpoint?.value;
  if (typeof wsEndpoint === 'string' && wsEndpoint.length > 0) {
    env.NEXT_PUBLIC_WS_ENDPOINT = wsEndpoint;
  }

  const restEndpoint = outputs.rest_endpoint?.value;
  if (typeof restEndpoint === 'string' && restEndpoint.length > 0) {
    env.NEXT_PUBLIC_REST_ENDPOINT = restEndpoint;
  }

  const stageFromOutputs = outputs.stage_name?.value;
  const stageName = options.stageName ?? (typeof stageFromOutputs === 'string' ? stageFromOutputs : undefined);
  if (stageName) {
    env.NEXT_PUBLIC_STAGE_NAME = stageName;
  }

  const staticDomain = outputs.static_site_domain?.value;
  if (typeof staticDomain === 'string' && staticDomain.length > 0) {
    env.NEXT_PUBLIC_STATIC_SITE_URL = staticDomain.startsWith('http')
      ? staticDomain
      : `https://${staticDomain}`;
  }

  return env;
};

module.exports = {
  readTerraformOutputs,
  mapOutputsToEnv,
};
