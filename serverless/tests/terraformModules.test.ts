import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => {
  const absolute = path.join(process.cwd(), relativePath);
  return readFileSync(absolute, 'utf8');
};

describe('Terraform modules for serverless infrastructure', () => {
  it('defines the WebSocket + Lambda module skeleton with throttling outputs', () => {
    const mainPath = 'serverless/terraform/modules/websocket_lambda/main.tf';
    const outputsPath = 'serverless/terraform/modules/websocket_lambda/outputs.tf';
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(outputsPath)).toBe(true);

    const main = read(mainPath);
    const outputs = read(outputsPath);

    expect(main).toContain('resource "aws_lambda_function"');
    expect(main).toContain('resource "aws_apigatewayv2_api"');
    expect(main).toMatch(/protocol_type\s*=\s*"WEBSOCKET"/);
    expect(main).toContain('resource "aws_apigatewayv2_stage"');
    expect(main).toContain('route_settings');
    expect(main).toContain('max_connections');

    expect(outputs).toContain('output "ws_endpoint"');
    expect(outputs).toContain('output "ws_callback_endpoint"');
  });

  it('provides the static site (S3 + CloudFront) module files', () => {
    const mainPath = 'serverless/terraform/modules/static_site/main.tf';
    const outputsPath = 'serverless/terraform/modules/static_site/outputs.tf';
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(outputsPath)).toBe(true);

    const main = read(mainPath);
    const outputs = read(outputsPath);

    expect(main).toContain('resource "aws_s3_bucket"');
    expect(main).toContain('resource "aws_cloudfront_distribution"');
    expect(main).toContain('origin_access_control');
    expect(outputs).toContain('output "static_site_domain"');
  });

  it('exposes secrets + session access storage module', () => {
    const mainPath = 'serverless/terraform/modules/session_access/main.tf';
    const outputsPath = 'serverless/terraform/modules/session_access/outputs.tf';
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(outputsPath)).toBe(true);

    const main = read(mainPath);
    const outputs = read(outputsPath);

    expect(main).toContain('resource "aws_secretsmanager_secret"');
    expect(main).toContain('resource "aws_dynamodb_table"');
    expect(main).toContain('joinTokenHash');
    expect(outputs).toContain('output "session_access_table_name"');
    expect(outputs).toContain('output "notion_secret_arn"');
  });

  it('provides monitoring module files with CloudWatch alarms', () => {
    const mainPath = 'serverless/terraform/modules/monitoring/main.tf';
    const outputsPath = 'serverless/terraform/modules/monitoring/outputs.tf';
    const variablesPath = 'serverless/terraform/modules/monitoring/variables.tf';
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(outputsPath)).toBe(true);
    expect(existsSync(variablesPath)).toBe(true);

    const main = read(mainPath);
    expect(main).toContain('aws_cloudwatch_metric_alarm');
    expect(main).toContain('ConnectionsActive');
    expect(main).toContain('Throttles');
    expect(main).toContain('5XXError');

    const outputs = read(outputsPath);
    expect(outputs).toContain('output "alarm_names"');
  });

  it('defines the HTTP session creation module with POST /sessions route', () => {
    const mainPath = 'serverless/terraform/modules/session_creation_http/main.tf';
    const outputsPath = 'serverless/terraform/modules/session_creation_http/outputs.tf';
    const variablesPath = 'serverless/terraform/modules/session_creation_http/variables.tf';
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(outputsPath)).toBe(true);
    expect(existsSync(variablesPath)).toBe(true);

    const main = read(mainPath);
    expect(main).toContain('protocol_type = "HTTP"');
    expect(main).toContain('route_key = "POST /sessions"');
    expect(main).toContain('aws_lambda_function');
    expect(main).toContain('aws_apigatewayv2_route');

    const outputs = read(outputsPath);
    expect(outputs).toContain('output "rest_endpoint"');
  });
});
