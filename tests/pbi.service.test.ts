import { describe, expect, it } from 'vitest';
import { listPbis, listSimilarPbis, findPbi } from '@/server/pbi/service';

describe('PBI service', () => {
  it('filters PBIs by status', async () => {
    const { items } = await listPbis({ status: 'Ready' });

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.status === 'Ready')).toBe(true);
  });

  it('filters PBIs by search keyword', async () => {
    const { items } = await listPbis({ search: 'WebSocket' });

    expect(items).not.toHaveLength(0);
    expect(items.every((item) => item.title.includes('WebSocket'))).toBe(true);
  });

  it('returns similar PBIs with same story point and completed status', async () => {
    const { items } = await listSimilarPbis('pbi_002'); // storyPoint: 3

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.storyPoint === 3)).toBe(true);
    expect(items.every((item) => item.status === 'Done' || item.status === 'Released')).toBe(true);
  });

  it('findPbi returns null when not found', async () => {
    const pbi = await findPbi('unknown-id');
    expect(pbi).toBeNull();
  });
});
