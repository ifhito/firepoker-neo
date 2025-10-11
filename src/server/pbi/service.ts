import type { PBIListResponse, ProductBacklogItem, SimilarPBIResponse } from '@/domain/pbi';
import { getNotionClient } from '@/server/notion/client';

export const listPbis = async (params: {
  status?: string;
  search?: string;
}): Promise<PBIListResponse> => {
  const notion = getNotionClient();
  const items = await notion.listPBIs(params);
  return { items, nextCursor: null };
};

export const findPbi = async (id: string): Promise<ProductBacklogItem | null> => {
  const notion = getNotionClient();
  return notion.findPBI(id);
};

export const listSimilarPbis = async (id: string): Promise<SimilarPBIResponse> => {
  const notion = getNotionClient();
  const items = await notion.listSimilarPbis(id);
  return { items };
};

export const listPbisByStoryPoints = async (points: number[]): Promise<SimilarPBIResponse> => {
  const notion = getNotionClient();
  const items = await notion.listPbisByStoryPoints(points);
  return { items };
};
