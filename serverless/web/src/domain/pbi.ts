export type PBIStatus = 'Backlog' | 'Ready' | 'InProgress' | 'Done' | 'Released' | string;

export interface ProductBacklogItem {
  id: string;
  title: string;
  status: PBIStatus;
  storyPoint: number | null;
  assignee: string | null;
  epic: string | null;
  sprint: string | null;
  lastEstimatedAt: string | null;
  notionUrl?: string;
}
