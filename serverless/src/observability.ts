type BaseLogger = Pick<typeof console, 'info' | 'warn' | 'error'>;

type LogLevel = 'info' | 'warn' | 'error';

interface StructuredLoggerOptions {
  logger?: BaseLogger;
  baseContext?: Record<string, unknown>;
  namespace?: string;
  defaultDimensions?: Record<string, string>;
}

export interface StructuredLogger {
  info(eventType: string, details?: Record<string, unknown>): void;
  warn(eventType: string, details?: Record<string, unknown>): void;
  error(eventType: string, details?: Record<string, unknown>): void;
  metric(name: string, value: number, dimensions?: Record<string, string>, unit?: string): void;
}

const defaultNamespace = 'FirePocker/Serverless';

export const createStructuredLogger = (options: StructuredLoggerOptions = {}): StructuredLogger => {
  const logger = options.logger ?? console;
  const baseContext = options.baseContext ?? {};
  const namespace = options.namespace ?? defaultNamespace;
  const defaultDimensions = options.defaultDimensions ?? {};

  const writeLog = (level: LogLevel, eventType: string, details: Record<string, unknown> = {}) => {
    const payload = {
      level,
      eventType,
      timestamp: Date.now(),
      ...baseContext,
      ...details,
    };
    logger[level]?.(JSON.stringify(payload));
  };

  const metric = (name: string, value: number, dimensions: Record<string, string> = {}, unit = 'Count') => {
    const mergedDimensions = { ...defaultDimensions, ...dimensions };
    const dimensionKeys = Object.keys(mergedDimensions);
    const payload = {
      ...mergedDimensions,
      [name]: value,
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: namespace,
            Dimensions: dimensionKeys.length > 0 ? [dimensionKeys] : [[]],
            Metrics: [
              {
                Name: name,
                Unit: unit,
              },
            ],
          },
        ],
      },
    };
    logger.info?.(JSON.stringify(payload));
  };

  return {
    info: (eventType, details) => writeLog('info', eventType, details),
    warn: (eventType, details) => writeLog('warn', eventType, details),
    error: (eventType, details) => writeLog('error', eventType, details),
    metric,
  };
};
