import { describe, expect, it } from 'vitest';
import { notionPropertyConfig } from '@/server/notion/config';

describe('notion property config', () => {
  it('provides defaults when env values are missing', () => {
    expect(notionPropertyConfig.title).toBeDefined();
    expect(notionPropertyConfig.status).toBeDefined();
  });
});
