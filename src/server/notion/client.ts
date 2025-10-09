import type { ProductBacklogItem } from '@/domain/pbi';
import '@/mocks/pbis';
import { notionEnv } from './config';

export interface NotionClient {
  listPBIs(params: { status?: string; search?: string }): Promise<ProductBacklogItem[]>;
  findPBI(id: string): Promise<ProductBacklogItem | null>;
  listSimilarPbis(pbiId: string): Promise<ProductBacklogItem[]>;
  updateStoryPoint(pbiId: string, point: number, memo?: string | null): Promise<void>;
}

class MockNotionClient implements NotionClient {
  constructor(private readonly dataset: ProductBacklogItem[]) {}

  async listPBIs(params: { status?: string; search?: string }) {
    return this.dataset.filter((item) => {
      const statusOk = params.status ? item.status === params.status : true;
      const searchOk = params.search
        ? item.title.toLowerCase().includes(params.search.toLowerCase())
        : true;
      return statusOk && searchOk;
    });
  }

  async findPBI(id: string) {
    return this.dataset.find((item) => item.id === id) ?? null;
  }

  async listSimilarPbis(pbiId: string) {
    const current = this.dataset.find((item) => item.id === pbiId);
    if (!current || current.storyPoint == null) {
      return [];
    }

    const allowedStatuses = new Set(['Done', 'Released']);

    return this.dataset
      .filter((item) =>
        item.id !== pbiId &&
        item.storyPoint === current.storyPoint &&
        item.lastEstimatedAt &&
        allowedStatuses.has(item.status),
      )
      .sort((a, b) => {
        const timeA = a.lastEstimatedAt ? Date.parse(a.lastEstimatedAt) : 0;
        const timeB = b.lastEstimatedAt ? Date.parse(b.lastEstimatedAt) : 0;
        return timeB - timeA;
      })
      .slice(0, 10);
  }

  async updateStoryPoint(pbiId: string, point: number) {
    const target = this.dataset.find((item) => item.id === pbiId);
    if (target) {
      target.storyPoint = point;
      target.lastEstimatedAt = new Date().toISOString();
    }
  }
}

let cachedClient: NotionClient | null = null;

export const getNotionClient = (): NotionClient => {
  if (cachedClient) {
    return cachedClient;
  }

  if (notionEnv.NOTION_TOKEN) {
    throw new Error('Real Notion client is not implemented in this prototype.');
  }

  const dataset: ProductBacklogItem[] = (globalThis as any).__firePockerMockPbis ?? [];
  cachedClient = new MockNotionClient(dataset);
  return cachedClient;
};
