import type { PBIListResponse, ProductBacklogItem, SimilarPBIResponse } from '@/domain/pbi';
import { getNotionClient } from '@/server/notion/client';

export const listPbis = async (params: {
  status?: string;
  search?: string;
  sprint?: string;
}): Promise<PBIListResponse> => {
  // スプリントが指定されていない場合は空配列を返す（全件取得を防ぐ）
  if (!params.sprint) {
    return { items: [], nextCursor: null };
  }

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

export const listPbisByStoryPoints = async (
  points: number[],
  options?: { sprint?: string | null },
): Promise<SimilarPBIResponse> => {
  const notion = getNotionClient();
  const items = await notion.listPbisByStoryPoints(points, options);
  return { items };
};
