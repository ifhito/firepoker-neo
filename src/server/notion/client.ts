import type { ProductBacklogItem } from '@/domain/pbi';
import '@/mocks/pbis';
import { HttpError } from '@/server/http/error';
import { extractPages, mapPageToProductBacklogItem } from './mapper';
import { notionEnv, notionPropertyConfig } from './config';

const {
  title: TITLE_PROPERTY,
  status: STATUS_PROPERTY,
  storyPoint: STORY_POINT_PROPERTY,
  assignee: ASSIGNEE_PROPERTY,
  epic: EPIC_PROPERTY,
  lastEstimatedAt: LAST_ESTIMATED_AT_PROPERTY,
} = notionPropertyConfig;

const propertyOptions = {
  ...(TITLE_PROPERTY ? { titleProperty: TITLE_PROPERTY } : {}),
  ...(STATUS_PROPERTY ? { statusProperty: STATUS_PROPERTY } : {}),
  ...(STORY_POINT_PROPERTY ? { storyPointProperty: STORY_POINT_PROPERTY } : {}),
  ...(ASSIGNEE_PROPERTY ? { assigneeProperty: ASSIGNEE_PROPERTY } : {}),
  ...(EPIC_PROPERTY ? { epicProperty: EPIC_PROPERTY } : {}),
  ...(LAST_ESTIMATED_AT_PROPERTY ? { lastEstimatedAtProperty: LAST_ESTIMATED_AT_PROPERTY } : {}),
};

const ALLOWED_SIMILAR_STATUSES = ['Backlog', 'Ready', 'InProgress', 'Done', 'Released'];
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const formatNotionId = (id: string) => {
  const compact = id.replace(/-/g, '');
  if (compact.length !== 32) {
    return id;
  }
  return [compact.slice(0, 8), compact.slice(8, 12), compact.slice(12, 16), compact.slice(16, 20), compact.slice(20)].join('-');
};

export interface NotionClient {
  listPBIs(params: { status?: string; search?: string }): Promise<ProductBacklogItem[]>;
  findPBI(id: string): Promise<ProductBacklogItem | null>;
  listSimilarPbis(pbiId: string): Promise<ProductBacklogItem[]>;
  listPbisByStoryPoints(points: number[]): Promise<ProductBacklogItem[]>;
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

    const allowedStatuses = new Set(ALLOWED_SIMILAR_STATUSES);

    return this.dataset
      .filter(
        (item) =>
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

  async listPbisByStoryPoints(points: number[]) {
    const allowedStatuses = new Set(ALLOWED_SIMILAR_STATUSES);
    
    return this.dataset
      .filter(
        (item) =>
          item.storyPoint !== null &&
          points.includes(item.storyPoint) &&
          item.lastEstimatedAt &&
          allowedStatuses.has(item.status),
      )
      .sort((a, b) => {
        const timeA = a.lastEstimatedAt ? Date.parse(a.lastEstimatedAt) : 0;
        const timeB = b.lastEstimatedAt ? Date.parse(b.lastEstimatedAt) : 0;
        return timeB - timeA;
      });
  }

  async updateStoryPoint(pbiId: string, point: number) {
    const target = this.dataset.find((item) => item.id === pbiId);
    if (target) {
      target.storyPoint = point;
      target.lastEstimatedAt = new Date().toISOString();
    }
  }
}

class RealNotionClient implements NotionClient {
  private readonly pbiDatabaseId: string;
  private readonly sessionDatabaseId?: string;
  private readonly token: string;
  private schema: Record<string, string> | null = null;

  constructor(token: string, pbiDatabaseId: string, sessionDatabaseId?: string) {
    this.token = token;
    this.pbiDatabaseId = pbiDatabaseId;
    this.sessionDatabaseId = sessionDatabaseId;
  }

  private async notionFetch<T>(endpoint: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${NOTION_API_BASE}${endpoint}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : `Failed to call Notion API (${response.status})`;
      throw new HttpError(response.status === 404 ? 404 : 502, 'NotionError', message, response.status >= 500);
    }

    return (await response.json()) as T;
  }

  private async loadSchema() {
    if (this.schema) {
      return this.schema;
    }

    const database = await this.notionFetch(`/databases/${formatNotionId(this.pbiDatabaseId)}`, {
      method: 'GET',
    });

    const properties = (database as any)?.properties ?? {};
    const schema: Record<string, string> = {};
    for (const [name, value] of Object.entries(properties)) {
      const type = (value as any)?.type;
      if (type) {
        schema[name] = type as string;
      }
    }
    this.schema = schema;
    return schema;
  }

  async listPBIs(params: { status?: string; search?: string }) {
    const schema = await this.loadSchema();
    const filterClauses: any[] = [];
    if (params.status && STATUS_PROPERTY) {
      const statusType = schema[STATUS_PROPERTY];
      if (statusType === 'select' || statusType === 'status') {
        const key = statusType === 'status' ? 'status' : 'select';
        filterClauses.push({
          property: STATUS_PROPERTY,
          [key]: { equals: params.status },
        });
      } else if (statusType === 'multi_select') {
        filterClauses.push({
          property: STATUS_PROPERTY,
          multi_select: { contains: params.status },
        });
      }
    }
    if (params.search && TITLE_PROPERTY) {
      filterClauses.push({
        property: TITLE_PROPERTY,
        title: { contains: params.search },
      });
    }

    const body: Record<string, unknown> = {
      page_size: 50,
    };

    if (LAST_ESTIMATED_AT_PROPERTY) {
      body.sorts = [
        {
          property: LAST_ESTIMATED_AT_PROPERTY,
          direction: 'descending',
        },
      ];
    }

    if (filterClauses.length === 1) {
      body.filter = filterClauses[0];
    } else if (filterClauses.length > 1) {
      body.filter = { and: filterClauses };
    }

    const response = await this.notionFetch(`/databases/${formatNotionId(this.pbiDatabaseId)}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return extractPages(response as any, propertyOptions);
  }

  async findPBI(id: string) {
    const isNotionId = /^[a-f0-9]{32}$/i.test(id.replace(/-/g, ''));
    if (!isNotionId) {
      return null;
    }

    const formattedId = formatNotionId(id);

    const page = await this.notionFetch(`/pages/${formattedId}`, { method: 'GET' }).catch((error) => {
      if (error instanceof HttpError && error.status === 404) {
        return null;
      }
      throw error;
    });

    if (!page) {
      return null;
    }

    return mapPageToProductBacklogItem(page as any, propertyOptions);
  }

  async listSimilarPbis(pbiId: string) {
    const source = await this.findPBI(pbiId);
    if (!source) {
      return [];
    }

    const schema = await this.loadSchema();
    const sorts = LAST_ESTIMATED_AT_PROPERTY && schema[LAST_ESTIMATED_AT_PROPERTY] === 'date'
      ? [
          {
            property: LAST_ESTIMATED_AT_PROPERTY,
            direction: 'descending',
          },
        ]
      : undefined;

    const filters: any[] = [];

    if (source.storyPoint != null && STORY_POINT_PROPERTY && schema[STORY_POINT_PROPERTY] === 'number') {
      filters.push({ property: STORY_POINT_PROPERTY, number: { equals: source.storyPoint } });
    }

    if (STATUS_PROPERTY && schema[STATUS_PROPERTY]) {
      const statusType = schema[STATUS_PROPERTY];
      if (statusType === 'multi_select') {
        filters.push({
          or: ALLOWED_SIMILAR_STATUSES.map((status) => ({
            property: STATUS_PROPERTY,
            multi_select: { contains: status },
          })),
        });
      } else if (statusType === 'select' || statusType === 'status') {
        const key = statusType === 'status' ? 'status' : 'select';
        filters.push({
          or: ALLOWED_SIMILAR_STATUSES.map((status) => ({
            property: STATUS_PROPERTY,
            [key]: { equals: status },
          })),
        });
      }
    }

    const response = (await this.notionFetch(`/databases/${formatNotionId(this.pbiDatabaseId)}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter:
          filters.length === 0
            ? undefined
            : filters.length === 1
            ? filters[0]
            : { and: filters },
        ...(sorts ? { sorts } : {}),
        page_size: 10,
      }),
    }));

    return extractPages(response as any, propertyOptions).filter((item: ProductBacklogItem) => item.id !== pbiId);
  }

  async listPbisByStoryPoints(points: number[]) {
    if (points.length === 0) {
      return [];
    }

    const schema = await this.loadSchema();
    const sorts = LAST_ESTIMATED_AT_PROPERTY && schema[LAST_ESTIMATED_AT_PROPERTY] === 'date'
      ? [
          {
            property: LAST_ESTIMATED_AT_PROPERTY,
            direction: 'descending',
          },
        ]
      : undefined;

    // 複数のポイントに対応するフィルター（Statusに関わらず全て取得）
    let filter: any = undefined;
    
    if (STORY_POINT_PROPERTY && schema[STORY_POINT_PROPERTY] === 'number') {
      if (points.length === 1) {
        filter = { property: STORY_POINT_PROPERTY, number: { equals: points[0] } };
      } else {
        filter = {
          or: points.map(point => ({
            property: STORY_POINT_PROPERTY,
            number: { equals: point }
          }))
        };
      }
    }

    const query = {
      filter,
      ...(sorts ? { sorts } : {}),
      page_size: 100,
    };

    const response = (await this.notionFetch(`/databases/${formatNotionId(this.pbiDatabaseId)}/query`, {
      method: 'POST',
      body: JSON.stringify(query),
    }));

    return extractPages(response as any, propertyOptions);
  }

  async updateStoryPoint(pbiId: string, point: number, memo?: string | null) {
    const formatted = formatNotionId(pbiId);
    await this.notionFetch(`/pages/${formatted}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          [STORY_POINT_PROPERTY]: { number: point },
          [LAST_ESTIMATED_AT_PROPERTY]: { date: { start: new Date().toISOString() } },
        },
      }),
    });

    if (this.sessionDatabaseId) {
      const sessionDb = formatNotionId(this.sessionDatabaseId);
      try {
        await this.notionFetch('/pages', {
          method: 'POST',
          body: JSON.stringify({
            parent: { database_id: sessionDb },
            properties: {
              Title: {
                title: [
                  {
                    text: {
                      content: `Session finalized for ${pbiId}`,
                    },
                  },
                ],
              },
              StoryPoint: { number: point },
              Notes: memo
                ? {
                    rich_text: [
                      {
                        text: { content: memo },
                      },
                    ],
                  }
                : { rich_text: [] },
            },
          }),
        });
      } catch (error) {
        console.warn('Failed to append session history to Notion', error);
      }
    }
  }
}

let cachedClient: NotionClient | null = null;

export const getNotionClient = (): NotionClient => {
  if (cachedClient) {
    console.log('[NotionClient] Using cached client');
    return cachedClient;
  }

  if (notionEnv.NOTION_TOKEN && notionEnv.NOTION_PBI_DB_ID) {
    console.log('[NotionClient] Initializing RealNotionClient with:', {
      token: notionEnv.NOTION_TOKEN.substring(0, 10) + '...',
      pbiDbId: notionEnv.NOTION_PBI_DB_ID,
      sessionDbId: notionEnv.NOTION_SESSION_DB_ID,
    });
    cachedClient = new RealNotionClient(
      notionEnv.NOTION_TOKEN,
      notionEnv.NOTION_PBI_DB_ID,
      notionEnv.NOTION_SESSION_DB_ID,
    );
    return cachedClient;
  }

  console.log('[NotionClient] Falling back to MockNotionClient');
  const dataset: ProductBacklogItem[] = (globalThis as any).__firePockerMockPbis ?? [];
  cachedClient = new MockNotionClient(dataset);
  return cachedClient;
};
