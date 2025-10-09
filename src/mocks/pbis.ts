import type { ProductBacklogItem } from '@/domain/pbi';

export const mockPbis: ProductBacklogItem[] = [
  {
    id: 'pbi_001',
    title: 'ログイン画面のアクセシビリティ改善',
    status: 'InProgress',
    storyPoint: 5,
    assignee: 'Ayaka Tanaka',
    epic: 'UX Improvements',
    lastEstimatedAt: '2024-03-10T02:15:00.000Z',
    notionUrl: 'https://www.notion.so/mock/pbi_001',
  },
  {
    id: 'pbi_002',
    title: 'セッション開始 API のレートリミット導入',
    status: 'Ready',
    storyPoint: 3,
    assignee: 'Kaito Suzuki',
    epic: 'Reliability',
    lastEstimatedAt: '2024-03-09T08:30:00.000Z',
    notionUrl: 'https://www.notion.so/mock/pbi_002',
  },
  {
    id: 'pbi_003',
    title: '投票画面の WebSocket 再接続処理',
    status: 'InProgress',
    storyPoint: 8,
    assignee: 'Sara Watanabe',
    epic: 'Realtime Foundation',
    lastEstimatedAt: '2024-03-07T06:45:00.000Z',
    notionUrl: 'https://www.notion.so/mock/pbi_003',
  },
  {
    id: 'pbi_004',
    title: 'Notion 類似 PBI クエリのキャッシュ層',
    status: 'Ready',
    storyPoint: 5,
    assignee: 'Daichi Mori',
    epic: 'Backend',
    lastEstimatedAt: '2024-02-28T12:00:00.000Z',
    notionUrl: 'https://www.notion.so/mock/pbi_004',
  },
  {
    id: 'pbi_005',
    title: 'Redis Streams ワーカーの PoC',
    status: 'Backlog',
    storyPoint: null,
    assignee: null,
    epic: 'Operational Excellence',
    lastEstimatedAt: null,
    notionUrl: 'https://www.notion.so/mock/pbi_005',
  },
  {
    id: 'pbi_006',
    title: '投票カードのキーボード操作対応',
    status: 'Done',
    storyPoint: 3,
    assignee: 'Ayaka Tanaka',
    epic: 'UX Improvements',
    lastEstimatedAt: '2024-02-15T04:00:00.000Z',
    notionUrl: 'https://www.notion.so/mock/pbi_006',
  },
  {
    id: 'pbi_007',
    title: 'セッション履歴表示のキャッシュ削除フロー',
    status: 'Released',
    storyPoint: 5,
    assignee: 'Kaito Suzuki',
    epic: 'Reliability',
    lastEstimatedAt: '2024-01-30T09:20:00.000Z',
    notionUrl: 'https://www.notion.so/mock/pbi_007',
  }
];

if (!(globalThis as any).__firePockerMockPbis) {
  (globalThis as any).__firePockerMockPbis = mockPbis;
}
