import { describe, expect, it } from 'vitest';
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { mapPageToProductBacklogItem } from '@/server/notion/mapper';

describe('mapPageToProductBacklogItem', () => {
  it('reads status property when Notion property type is status', () => {
    const page = {
      object: 'page',
      id: 'test-page-id',
      properties: {
        Title: {
          id: 'title',
          type: 'title',
          title: [
            {
              type: 'text',
              text: { content: 'ステータス取り込みテスト', link: null },
              plain_text: 'ステータス取り込みテスト',
              href: null,
              annotations: {
                bold: false,
                code: false,
                color: 'default',
                italic: false,
                strikethrough: false,
                underline: false,
              },
            },
          ],
        },
        ステータス: {
          id: 'status',
          type: 'status',
          status: {
            id: 'done',
            name: 'Done',
            color: 'green',
          },
        },
        ポイント: {
          id: 'points',
          type: 'number',
          number: 5,
        },
        Sprint: {
          id: 'sprint',
          type: 'select',
          select: {
            id: 'sprint-220',
            name: '220',
            color: 'blue',
          },
        },
      },
      url: 'https://www.notion.so/mock/test-page-id',
    } as unknown as PageObjectResponse;

    const item = mapPageToProductBacklogItem(page, {
      statusProperty: 'ステータス',
      titleProperty: 'Title',
      storyPointProperty: 'ポイント',
      sprintProperty: 'Sprint',
    });

    expect(item).not.toBeNull();
    expect(item?.status).toBe('Done');
    expect(item?.storyPoint).toBe(5);
    expect(item?.sprint).toBe('220');
  });
});
