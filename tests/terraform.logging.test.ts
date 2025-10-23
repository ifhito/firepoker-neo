import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const terraformMainPath = resolve(process.cwd(), 'terraform/main.tf');

const readMainTf = () => readFileSync(terraformMainPath, 'utf8');

describe('terraform logging configuration', () => {
  it('does not define CloudWatch log groups', () => {
    const terraformMain = readMainTf();
    expect(terraformMain).not.toMatch(/resource "aws_cloudwatch_log_group"/);
  });

  it('defines an S3 bucket for logs', () => {
    const terraformMain = readMainTf();
    expect(terraformMain).toMatch(/resource "aws_s3_bucket" "logs"/);
  });

  it('routes ECS container logs through FireLens S3 output', () => {
    const terraformMain = readMainTf();
    expect(terraformMain).toMatch(/logDriver\s*=\s*"awsfirelens"/);
    expect(terraformMain).toMatch(/"Name"\s*=\s*"s3"/);
  });
});

describe('terraform ecs cluster cost optimizations', () => {
  it('does not enable container insights', () => {
    const terraformMain = readMainTf();
    expect(terraformMain).not.toMatch(/containerInsights/);
  });

  it('does not configure additional capacity providers', () => {
    const terraformMain = readMainTf();
    expect(terraformMain).not.toMatch(/aws_ecs_cluster_capacity_providers/);
    expect(terraformMain).not.toMatch(/FARGATE_SPOT/);
  });
});

describe('terraform outputs', () => {
  const outputsPath = resolve(process.cwd(), 'terraform/outputs.tf');

  it('does not expose CloudWatch log group outputs', () => {
    const outputsTf = readFileSync(outputsPath, 'utf8');
    expect(outputsTf).not.toMatch(/cloudwatch_log_group/);
  });
});
