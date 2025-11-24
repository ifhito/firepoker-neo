#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { readTerraformOutputs, mapOutputsToEnv } = require('./lib/terraformOutputs.js');

const parseArgs = (argv) => {
  const args = { outputs: 'serverless/terraform/outputs.json', stage: process.env.NEXT_PUBLIC_STAGE_NAME };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--outputs' && argv[i + 1]) {
      args.outputs = argv[i + 1];
      i += 1;
    } else if (current === '--stage' && argv[i + 1]) {
      args.stage = argv[i + 1];
      i += 1;
    }
  }
  return args;
};

const args = parseArgs(process.argv.slice(2));
const outputsPath = path.resolve(process.cwd(), args.outputs);
const outputs = readTerraformOutputs(outputsPath);
const envValues = mapOutputsToEnv(outputs, { stageName: args.stage });
Object.assign(process.env, envValues);

if (Object.keys(envValues).length > 0) {
  console.log('\n[export-with-outputs] Injected environment variables from', outputsPath);
  console.log(envValues);
}

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run('pnpm', ['exec', 'next', 'build', 'serverless/web']);
