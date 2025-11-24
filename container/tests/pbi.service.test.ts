import { describe, expect, it } from 'vitest';
import { listPbis, listSimilarPbis, findPbi } from '@/server/pbi/service';

describe('PBI service', () => {
  it('filters PBIs by status', async () => {
    const { items } = await listPbis({ status: 'Ready', sprint: 'Sprint 15' });

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.status === 'Ready')).toBe(true);
  });

  it('filters PBIs by search keyword', async () => {
    const { items } = await listPbis({ search: 'API', sprint: 'Sprint 15' });

    expect(items).not.toHaveLength(0);
    expect(items.every((item) => item.title.includes('API'))).toBe(true);
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

  it('should return empty list when sprint filter is not provided', async () => {
    const { items } = await listPbis({});
    
    // スプリント未指定の場合は空配列を返す（全件取得を防ぐ）
    expect(items).toEqual([]);
  });

  it('should return PBIs when sprint filter is provided', async () => {
    const { items } = await listPbis({ sprint: 'Sprint 15' });
    
    // スプリント指定時は結果を返す
    expect(Array.isArray(items)).toBe(true);
  });
});
