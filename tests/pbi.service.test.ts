import { describe, expect, it } from 'vitest';
import { listPbis, listSimilarPbis, findPbi, listPbisByStoryPoints } from '@/server/pbi/service';

const parseSprintNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const matches = value.match(/(\d+)/g);
  if (!matches || matches.length === 0) {
    return null;
  }
  const last = matches[matches.length - 1];
  const parsed = Number.parseInt(last, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const withinTwoSprints = (candidate: string | null | undefined, target: string | null | undefined) => {
  const targetNumber = parseSprintNumber(target);
  if (targetNumber === null) {
    return true;
  }
  const candidateNumber = parseSprintNumber(candidate);
  if (candidateNumber === null) {
    return false;
  }
  return candidateNumber <= targetNumber && candidateNumber >= targetNumber - 2;
};

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

  it('returns similar PBIs with same story point, completed status, and within two sprints', async () => {
    const source = await findPbi('pbi_002'); // storyPoint: 3, sprint: Sprint 15
    const { items } = await listSimilarPbis('pbi_002');

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.storyPoint === 3)).toBe(true);
    expect(items.every((item) => item.status === 'Done' || item.status === 'Released')).toBe(true);
    expect(items.every((item) => withinTwoSprints(item.sprint, source?.sprint))).toBe(true);
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

  it('limits point history lookups to within two sprints when sprint is provided', async () => {
    const response = await listPbisByStoryPoints([3], { sprint: 'Sprint 15' });

    expect(response.items.length).toBeGreaterThan(0);
    expect(response.items.every((item) => withinTwoSprints(item.sprint, 'Sprint 15'))).toBe(true);
  });
});
