import { z } from 'zod';

const nonEmptyString = (message: string) => z.string().trim().min(1, message);

export const facilitatorSchema = z.object({
  id: nonEmptyString('ファシリテーター ID を入力してください'),
  name: nonEmptyString('ファシリテーター名を入力してください'),
});

const backlogSourceSchema = z
  .object({
    notionDbId: z.string().trim().min(1).optional(),
    filter: z.string().trim().min(1).optional(),
  })
  .optional();

export const sessionCreationRequestSchema = z.object({
  title: nonEmptyString('タイトルを入力してください'),
  facilitator: facilitatorSchema,
  backlogSource: backlogSourceSchema,
  connectionCap: z.number().int().positive().max(200).optional(),
  publicView: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateSessionRequest = z.infer<typeof sessionCreationRequestSchema>;

export interface CreateSessionResponse {
  sessionId: string;
  joinToken: string;
  expiresAt: string;
}

export const DEFAULT_MAX_CONNECTIONS = 10;
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
