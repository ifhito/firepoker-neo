import { ZodError } from 'zod';

export type ErrorCode =
  | 'ValidationError'
  | 'NotFound'
  | 'Conflict'
  | 'NotionError'
  | 'InternalError';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ErrorResponseBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export const toErrorResponse = (error: unknown): { status: number; body: ErrorResponseBody } => {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      },
    };
  }

  if (error instanceof ZodError) {
    const message = error.errors.map((err) => err.message).join(', ');
    return {
      status: 400,
      body: {
        code: 'ValidationError',
        message: message || 'Request validation failed.',
        retryable: false,
      },
    };
  }

  console.error('Unhandled error', error);

  return {
    status: 500,
    body: {
      code: 'InternalError',
      message: 'An unexpected error occurred.',
      retryable: false,
    },
  };
};
