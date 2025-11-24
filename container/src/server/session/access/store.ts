import crypto from 'node:crypto';

type DynamoDocumentClient = {
  put(params: Record<string, unknown>): { promise(): Promise<unknown> };
  get(params: Record<string, unknown>): { promise(): Promise<{ Item?: SessionAccessRecord }> };
  update(params: Record<string, unknown>): { promise(): Promise<{ Attributes?: Record<string, unknown> }> };
};

export interface SessionAccessRecord {
  sessionId: string;
  joinTokenHash: string;
  maxConnections: number;
  activeConnections: number;
  expiresAt: number;
}

export interface SessionAccessEntry {
  sessionId: string;
  joinTokenHash: string;
  maxConnections: number;
  expiresAt: number;
}

export interface SessionAccessStore {
  putSessionAccess(entry: SessionAccessEntry): Promise<void>;
  getSessionAccess(sessionId: string): Promise<SessionAccessRecord | null>;
  incrementActiveConnections(
    sessionId: string,
    maxConnections: number,
  ): Promise<{ allowed: boolean; activeConnections: number }>;
  decrementActiveConnections(sessionId: string): Promise<number>;
}

export const DEFAULT_MAX_CONNECTIONS = Number(process.env.SESSION_ACCESS_MAX_CONNECTIONS ?? 10);

let sharedStore: SessionAccessStore | null = null;

export const hashJoinToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('base64');

export const getSessionAccessStore = (): SessionAccessStore => {
  if (sharedStore) {
    return sharedStore;
  }

  const tableName = process.env.SESSION_ACCESS_TABLE_NAME;
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
  if (tableName) {
    const dynamoStore = createDynamoSessionAccessStore({ tableName, region });
    if (dynamoStore) {
      sharedStore = dynamoStore;
      return sharedStore;
    }
    console.warn('aws-sdk is not available; falling back to in-memory session access store.');
  }

  sharedStore = new InMemorySessionAccessStore();
  return sharedStore;
};

export const setSessionAccessStoreForTests = (store: SessionAccessStore | null) => {
  sharedStore = store;
};

class InMemorySessionAccessStore implements SessionAccessStore {
  private readonly data = new Map<string, SessionAccessRecord>();

  async putSessionAccess(entry: SessionAccessEntry): Promise<void> {
    this.data.set(entry.sessionId, {
      sessionId: entry.sessionId,
      joinTokenHash: entry.joinTokenHash,
      maxConnections: entry.maxConnections,
      activeConnections: 0,
      expiresAt: entry.expiresAt,
    });
  }

  async getSessionAccess(sessionId: string): Promise<SessionAccessRecord | null> {
    return this.data.get(sessionId) ?? null;
  }

  async incrementActiveConnections(
    sessionId: string,
    maxConnections: number,
  ): Promise<{ allowed: boolean; activeConnections: number }> {
    const record = this.data.get(sessionId);
    if (!record) {
      return { allowed: false, activeConnections: 0 };
    }

    if (record.activeConnections >= maxConnections) {
      return { allowed: false, activeConnections: record.activeConnections };
    }

    record.activeConnections += 1;
    return { allowed: true, activeConnections: record.activeConnections };
  }

  async decrementActiveConnections(sessionId: string): Promise<number> {
    const record = this.data.get(sessionId);
    if (!record) {
      return 0;
    }
    record.activeConnections = Math.max(0, record.activeConnections - 1);
    return record.activeConnections;
  }
}

const createDynamoSessionAccessStore = ({
  tableName,
  region,
}: {
  tableName: string;
  region: string;
}): SessionAccessStore | null => {
  let AWS: { DynamoDB: { DocumentClient: new (options: { region: string }) => DynamoDocumentClient } } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    AWS = require('aws-sdk');
  } catch {
    return null;
  }

  const documentClient = new AWS.DynamoDB.DocumentClient({ region });
  return new DynamoSessionAccessStore(documentClient, tableName);
};

class DynamoSessionAccessStore implements SessionAccessStore {
  constructor(private readonly client: DynamoDocumentClient, private readonly tableName: string) {}

  async putSessionAccess(entry: SessionAccessEntry): Promise<void> {
    await this.client
      .put({
        TableName: this.tableName,
        Item: {
          sessionId: entry.sessionId,
          joinTokenHash: entry.joinTokenHash,
          maxConnections: entry.maxConnections,
          activeConnections: 0,
          expiresAt: entry.expiresAt,
        },
      })
      .promise();
  }

  async getSessionAccess(sessionId: string): Promise<SessionAccessRecord | null> {
    const result = await this.client
      .get({
        TableName: this.tableName,
        Key: { sessionId },
      })
      .promise();
    return result.Item ?? null;
  }

  async incrementActiveConnections(
    sessionId: string,
    maxConnections: number,
  ): Promise<{ allowed: boolean; activeConnections: number }> {
    try {
      const response = await this.client
        .update({
          TableName: this.tableName,
          Key: { sessionId },
          UpdateExpression: 'SET activeConnections = if_not_exists(activeConnections, :zero) + :one',
          ConditionExpression: 'attribute_not_exists(activeConnections) OR activeConnections < :max',
          ExpressionAttributeValues: {
            ':one': 1,
            ':zero': 0,
            ':max': maxConnections,
          },
          ReturnValues: 'UPDATED_NEW',
        })
        .promise();
      const activeConnections = Number(response.Attributes?.activeConnections ?? maxConnections);
      return { allowed: true, activeConnections };
    } catch (error: any) {
      if (error?.code === 'ConditionalCheckFailedException') {
        return { allowed: false, activeConnections: maxConnections };
      }
      throw error;
    }
  }

  async decrementActiveConnections(sessionId: string): Promise<number> {
    try {
      const response = await this.client
        .update({
          TableName: this.tableName,
          Key: { sessionId },
          UpdateExpression: 'SET activeConnections = if_not_exists(activeConnections, :zero) - :one',
          ConditionExpression: 'attribute_exists(activeConnections) AND activeConnections > :zero',
          ExpressionAttributeValues: {
            ':one': 1,
            ':zero': 0,
          },
          ReturnValues: 'UPDATED_NEW',
        })
        .promise();
      return Number(response.Attributes?.activeConnections ?? 0);
    } catch (error: any) {
      if (error?.code === 'ConditionalCheckFailedException') {
        return 0;
      }
      throw error;
    }
  }
}
