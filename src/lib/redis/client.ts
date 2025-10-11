import Redis, { type Redis as RedisClient } from 'ioredis';
import RedisMock from 'ioredis-mock';

type RedisFactory = () => RedisClient;

let client: RedisClient | null = null;
let clientKind: 'redis' | 'mock' | null = null;

const instantiateMock = (): RedisClient => {
  clientKind = 'mock';
  return new (RedisMock as unknown as typeof Redis)();
};

const createRedisClient: RedisFactory = () => {
  if (process.env.NODE_ENV === 'test' || process.env.USE_REDIS_MOCK === 'true') {
    return instantiateMock();
  }

  const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const instance = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  clientKind = 'redis';

  instance.on('error', (error) => {
    console.warn('[redis] connection error', error);
  });

  return instance;
};

const ensureConnected = async (instance: RedisClient) => {
  if (clientKind === 'mock') {
    return;
  }

  if (typeof instance.status === 'string' && ['wait', 'close', 'end'].includes(instance.status)) {
    await instance.connect();
  }
};

export const getRedisClient = (): RedisClient => {
  if (!client) {
    client = createRedisClient();
  }
  return client;
};

export const getConnectedRedisClient = async (): Promise<RedisClient> => {
  const instance = getRedisClient();

  if (clientKind === 'redis' && typeof (instance as any).connect === 'function') {
    try {
      await ensureConnected(instance);
    } catch (error) {
      console.warn('[redis] falling back to in-memory mock', error);
      instance.disconnect();
      client = instantiateMock();
    }
  }

  if (!client) {
    client = instantiateMock();
  }

  return client;
};

export const resetRedisClient = () => {
  if (client) {
    client.disconnect();
  }
  client = null;
  clientKind = null;
};
