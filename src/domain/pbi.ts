export type PBIStatus = 'Backlog' | 'Ready' | 'InProgress' | 'Done' | 'Released';

export interface ProductBacklogItem {
  id: string;
  title: string;
  status: PBIStatus;
  storyPoint: number | null;
  assignee: string | null;
  epic: string | null;
  lastEstimatedAt: string | null;
  notionUrl?: string;
}

export interface PBIListResponse {
  items: ProductBacklogItem[];
  nextCursor?: string | null;
}

export interface SimilarPBIResponse {
  items: ProductBacklogItem[];
}
