import type { SessionMetadataRecord } from './sessionMetadataStore';
import { putSessionMetadata } from './sessionMetadataStore';
import { publishSessionAccess } from '@/server/session/access/publisher';

export interface SessionCreationInput {
  metadata: SessionMetadataRecord;
  joinToken: string;
  maxConnections: number;
}

export const createSessionRecords = async (input: SessionCreationInput): Promise<void> => {
  try {
    await putSessionMetadata(input.metadata);
  } catch (error) {
    throw new Error(`Failed to store session metadata: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await publishSessionAccess({
      sessionId: input.metadata.sessionId,
      joinToken: input.joinToken,
      expiresAt: input.metadata.expiresAt,
      maxConnections: input.maxConnections,
    });
  } catch (error) {
    throw new Error(`Failed to publish session access: ${error instanceof Error ? error.message : String(error)}`);
  }
};
