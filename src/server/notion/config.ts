import { z } from 'zod';

const envSchema = z.object({
  NOTION_TOKEN: z.string().min(1).optional(),
  NOTION_PBI_DB_ID: z.string().min(1).optional(),
  NOTION_SESSION_DB_ID: z.string().min(1).optional(),
  NOTION_PBI_TITLE_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_STATUS_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_STORYPOINT_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_ASSIGNEE_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_EPIC_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_SPRINT_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_LASTESTIMATED_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_TICKETTYPE_PROPERTY: z.string().min(1).optional(),
  NOTION_PBI_TICKETTYPE_VALUE: z.string().min(1).optional(),
  NOTION_PBI_DEFAULT_STATUS_FILTER: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.warn('Failed to parse Notion related environment variables.', parsed.error.flatten());
}

export const notionEnv = parsed.success
  ? parsed.data
  : {
      NOTION_TOKEN: undefined,
      NOTION_PBI_DB_ID: undefined,
      NOTION_SESSION_DB_ID: undefined,
      NOTION_PBI_TITLE_PROPERTY: undefined,
      NOTION_PBI_STATUS_PROPERTY: undefined,
      NOTION_PBI_STORYPOINT_PROPERTY: undefined,
      NOTION_PBI_ASSIGNEE_PROPERTY: undefined,
      NOTION_PBI_EPIC_PROPERTY: undefined,
      NOTION_PBI_SPRINT_PROPERTY: undefined,
      NOTION_PBI_LASTESTIMATED_PROPERTY: undefined,
      NOTION_PBI_TICKETTYPE_PROPERTY: undefined,
      NOTION_PBI_TICKETTYPE_VALUE: undefined,
      NOTION_PBI_DEFAULT_STATUS_FILTER: undefined,
    };

console.log('[Notion Config] Environment variables loaded:', {
  hasToken: !!notionEnv.NOTION_TOKEN,
  hasPbiDbId: !!notionEnv.NOTION_PBI_DB_ID,
  token: notionEnv.NOTION_TOKEN ? notionEnv.NOTION_TOKEN.substring(0, 10) + '...' : 'undefined',
  pbiDbId: notionEnv.NOTION_PBI_DB_ID,
});

const missing = Object.entries(notionEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.warn(
    `Notion environment variables missing: ${missing.join(', ')}. Falling back to mock data source.`,
  );
}

export const notionPropertyConfig = {
  title: notionEnv.NOTION_PBI_TITLE_PROPERTY ?? 'Title',
  status: notionEnv.NOTION_PBI_STATUS_PROPERTY ?? 'Status',
  storyPoint: notionEnv.NOTION_PBI_STORYPOINT_PROPERTY ?? 'StoryPoint',
  assignee: notionEnv.NOTION_PBI_ASSIGNEE_PROPERTY ?? 'Assignee',
  epic: notionEnv.NOTION_PBI_EPIC_PROPERTY ?? 'Epic',
  sprint: notionEnv.NOTION_PBI_SPRINT_PROPERTY ?? 'Sprint',
  lastEstimatedAt: notionEnv.NOTION_PBI_LASTESTIMATED_PROPERTY ?? 'LastEstimatedAt',
  ticketType: notionEnv.NOTION_PBI_TICKETTYPE_PROPERTY ?? 'TicketType',
};

export const notionFilterConfig = {
  ticketTypeValue: notionEnv.NOTION_PBI_TICKETTYPE_VALUE ?? null,
  defaultStatusFilter: notionEnv.NOTION_PBI_DEFAULT_STATUS_FILTER ?? null,
};
