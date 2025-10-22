import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('RealNotionClient (filters)', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NOTION_TOKEN = 'test-token';
    process.env.NOTION_PBI_DB_ID = 'ffffffffffffffffffffffffffffffff';
    process.env.NOTION_PBI_STATUS_PROPERTY = 'ステータス';
    process.env.NOTION_PBI_SPRINT_PROPERTY = 'Sprint';
    process.env.NOTION_PBI_TICKETTYPE_PROPERTY = 'チケット種別';
    process.env.NOTION_PBI_TICKETTYPE_VALUE = 'PBI';
    process.env.NOTION_PBI_DEFAULT_STATUS_FILTER = 'PBI';
    process.env.NOTION_PBI_STORYPOINT_PROPERTY = 'ポイント';
    process.env.NOTION_PBI_LASTESTIMATED_PROPERTY = 'LastEstimatedAt';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it('applies ticket type, default status, and sprint filters when querying PBIs', async () => {
    const schemaResponse = {
      ok: true,
      json: async () => ({
        properties: {
          ステータス: { type: 'status' },
          Sprint: { type: 'select' },
          チケット種別: { type: 'select' },
        },
      }),
    };

    const queryResponse = {
      ok: true,
      json: async () => ({ results: [] }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(schemaResponse as any)
      .mockResolvedValueOnce(queryResponse as any);
    vi.stubGlobal('fetch', fetchMock);

    const { getNotionClient } = await import('@/server/notion/client');
    const client = getNotionClient();

    await client.listPBIs({ sprint: '220' });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const queryCall = fetchMock.mock.calls[1];
    expect(queryCall?.[0]).toBe('https://api.notion.com/v1/databases/ffffffff-ffff-ffff-ffff-ffffffffffff/query');
    const init = queryCall?.[1] as RequestInit;
    expect(init?.method).toBe('POST');

    const body = JSON.parse(init?.body as string);
    expect(body.filter?.and).toEqual(
      expect.arrayContaining([
        {
          property: 'チケット種別',
          select: { equals: 'PBI' },
        },
        {
          property: 'ステータス',
          status: { equals: 'PBI' },
        },
        {
          property: 'Sprint',
          select: { equals: '220' },
        },
      ]),
    );
  });

  it('uses provided status filter instead of default when specified', async () => {
    const schemaResponse = {
      ok: true,
      json: async () => ({
        properties: {
          ステータス: { type: 'status' },
          Sprint: { type: 'select' },
          チケット種別: { type: 'select' },
        },
      }),
    };

    const queryResponse = {
      ok: true,
      json: async () => ({ results: [] }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(schemaResponse as any)
      .mockResolvedValueOnce(queryResponse as any);
    vi.stubGlobal('fetch', fetchMock);

    const { getNotionClient } = await import('@/server/notion/client');
    const client = getNotionClient();

    await client.listPBIs({ sprint: '220', status: 'InProgress' });

    const queryCall = fetchMock.mock.calls[1];
    const init = queryCall?.[1] as RequestInit;
    const body = JSON.parse(init?.body as string);
    expect(body.filter?.and).toEqual(
      expect.arrayContaining([
        {
          property: 'チケット種別',
          select: { equals: 'PBI' },
        },
        {
          property: 'ステータス',
          status: { equals: 'InProgress' },
        },
      ]),
    );
  });

  it('applies ticket type filter to similar PBI queries', async () => {
    const pageResponse = {
      ok: true,
      json: async () => ({
        object: 'page',
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        properties: {
          Title: {
            type: 'title',
            title: [],
          },
          ステータス: {
            type: 'status',
            status: { name: 'Done' },
          },
          ポイント: {
            type: 'number',
            number: 3,
          },
          チケット種別: {
            type: 'select',
            select: { name: 'PBI' },
          },
          Sprint: {
            type: 'select',
            select: { name: '220' },
          },
        },
        url: 'https://www.notion.so/mock',
      }),
    };

    const schemaResponse = {
      ok: true,
      json: async () => ({
        properties: {
          ステータス: { type: 'status' },
          Sprint: { type: 'select' },
          チケット種別: { type: 'select' },
          ポイント: { type: 'number' },
          LastEstimatedAt: { type: 'date' },
        },
      }),
    };

    const queryResponse = {
      ok: true,
      json: async () => ({ results: [] }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pageResponse as any) // findPBI
      .mockResolvedValueOnce(schemaResponse as any) // schema
      .mockResolvedValueOnce(queryResponse as any); // similar query
    vi.stubGlobal('fetch', fetchMock);

    const { getNotionClient } = await import('@/server/notion/client');
    const client = getNotionClient();

    await client.listSimilarPbis('ffffffffffffffffffffffffffffffff');

    const queryCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/databases/ffffffff-ffff-ffff-ffff-ffffffffffff/query'),
    );
    expect(queryCall).toBeDefined();
    const init = queryCall?.[1] as RequestInit;
    const body = JSON.parse(init?.body as string);

    const filters = Array.isArray(body.filter?.and) ? body.filter.and : [body.filter];
    expect(filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'チケット種別',
          select: { equals: 'PBI' },
        }),
      ]),
    );
  });

  it('limits similar PBI results to within two sprints of the source', async () => {
    const buildPage = (id: string, sprint: string) => ({
      object: 'page',
      id,
      properties: {
        Title: { type: 'title', title: [] },
        ステータス: { type: 'status', status: { name: 'Done' } },
        ポイント: { type: 'number', number: 3 },
        チケット種別: { type: 'select', select: { name: 'PBI' } },
        Sprint: { type: 'select', select: { name: sprint } },
        LastEstimatedAt: { type: 'date', date: { start: '2024-03-01T00:00:00.000Z' } },
      },
      url: `https://www.notion.so/${id}`,
    });

    const pageResponse = {
      ok: true,
      json: async () => ({
        object: 'page',
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        properties: {
          Title: { type: 'title', title: [] },
          ステータス: { type: 'status', status: { name: 'Done' } },
          ポイント: { type: 'number', number: 3 },
          チケット種別: { type: 'select', select: { name: 'PBI' } },
          Sprint: { type: 'select', select: { name: '220' } },
        },
        url: 'https://www.notion.so/mock',
      }),
    };

    const schemaResponse = {
      ok: true,
      json: async () => ({
        properties: {
          ステータス: { type: 'status' },
          Sprint: { type: 'select' },
          チケット種別: { type: 'select' },
          ポイント: { type: 'number' },
          LastEstimatedAt: { type: 'date' },
        },
      }),
    };

    const queryResponse = {
      ok: true,
      json: async () => ({
        results: [
          buildPage('page-1', '220'),
          buildPage('page-2', '219'),
          buildPage('page-3', '217'),
        ],
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pageResponse as any) // findPBI
      .mockResolvedValueOnce(schemaResponse as any) // schema
      .mockResolvedValueOnce(queryResponse as any); // similar query
    vi.stubGlobal('fetch', fetchMock);

    const { getNotionClient } = await import('@/server/notion/client');
    const client = getNotionClient();

    const result = await client.listSimilarPbis('ffffffffffffffffffffffffffffffff');

    expect(result.map((item) => item.sprint)).toEqual(['220', '219']);
  });

  it('applies ticket type filter to list by story points', async () => {
    const schemaResponse = {
      ok: true,
      json: async () => ({
        properties: {
          チケット種別: { type: 'select' },
          ポイント: { type: 'number' },
          LastEstimatedAt: { type: 'date' },
        },
      }),
    };

    const queryResponse = {
      ok: true,
      json: async () => ({ results: [] }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(schemaResponse as any)
      .mockResolvedValueOnce(queryResponse as any);
    vi.stubGlobal('fetch', fetchMock);

    const { getNotionClient } = await import('@/server/notion/client');
    const client = getNotionClient();

    await client.listPbisByStoryPoints([1, 3, 5]);

    const queryCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/databases/ffffffff-ffff-ffff-ffff-ffffffffffff/query'),
    );
    expect(queryCall).toBeDefined();
    const init = queryCall?.[1] as RequestInit;
    const body = JSON.parse(init?.body as string);
    const filters = Array.isArray(body.filter?.and) ? body.filter.and : [body.filter].filter(Boolean);
    expect(filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'チケット種別',
          select: { equals: 'PBI' },
        }),
      ]),
    );
  });

  it('limits story point lookup results to within two sprints when sprint is provided', async () => {
    const buildPage = (id: string, sprint: string) => ({
      object: 'page',
      id,
      properties: {
        Title: { type: 'title', title: [] },
        チケット種別: { type: 'select', select: { name: 'PBI' } },
        ポイント: { type: 'number', number: 3 },
        Sprint: { type: 'select', select: { name: sprint } },
        LastEstimatedAt: { type: 'date', date: { start: '2024-03-01T00:00:00.000Z' } },
      },
      url: `https://www.notion.so/${id}`,
    });

    const schemaResponse = {
      ok: true,
      json: async () => ({
        properties: {
          チケット種別: { type: 'select' },
          ポイント: { type: 'number' },
          Sprint: { type: 'select' },
          LastEstimatedAt: { type: 'date' },
        },
      }),
    };

    const queryResponse = {
      ok: true,
      json: async () => ({
        results: [
          buildPage('page-1', '220'),
          buildPage('page-2', '219'),
          buildPage('page-3', '217'),
        ],
      }),
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(schemaResponse as any)
      .mockResolvedValueOnce(queryResponse as any);
    vi.stubGlobal('fetch', fetchMock);

    const { getNotionClient } = await import('@/server/notion/client');
    const client = getNotionClient();

    const items = await client.listPbisByStoryPoints([3], { sprint: '220' });

    expect(items.map((item: any) => item.sprint)).toEqual(['220', '219']);
  });
});
