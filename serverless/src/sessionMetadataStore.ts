type DocumentClient = {
  put(params: Record<string, unknown>): { promise(): Promise<unknown> };
};

let cachedClient: DocumentClient | null = null;

export const setDocumentClientForTests = (client: DocumentClient | null) => {
  cachedClient = client;
};

const getDocumentClient = (): DocumentClient => {
  if (cachedClient) {
    return cachedClient;
  }
  let AWS: { DynamoDB: { DocumentClient: new (options: Record<string, unknown>) => DocumentClient } } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    AWS = require('aws-sdk');
  } catch {
    AWS = null;
  }
  if (!AWS) {
    throw new Error('aws-sdk is not available in the current environment');
  }
  cachedClient = new AWS.DynamoDB.DocumentClient({
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
  });
  return cachedClient;
};

export interface SessionMetadataRecord {
  sessionId: string;
  title: string;
  facilitatorId: string;
  facilitatorName: string;
  backlogSource: Record<string, unknown>;
  connectionCap: number;
  publicViewEnabled: boolean;
  createdAt: string;
  expiresAt: number;
}

export const putSessionMetadata = async (record: SessionMetadataRecord): Promise<void> => {
  const tableName = process.env.SESSION_METADATA_TABLE_NAME;
  if (!tableName) {
    throw new Error('SESSION_METADATA_TABLE_NAME is not configured');
  }
  const client = getDocumentClient();
  await client
    .put({
      TableName: tableName,
      Item: record,
    })
    .promise();
};
