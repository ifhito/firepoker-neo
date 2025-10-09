import { z } from 'zod';

const envSchema = z.object({
  NOTION_TOKEN: z.string().min(1).optional(),
  NOTION_PBI_DB_ID: z.string().min(1).optional(),
  NOTION_SESSION_DB_ID: z.string().min(1).optional(),
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
    };

const missing = Object.entries(notionEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.warn(
    `Notion environment variables missing: ${missing.join(', ')}. Falling back to mock data source.`,
  );
}
