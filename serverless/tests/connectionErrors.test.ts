import { describe, expect, it } from 'vitest';

import { describeConnectionError } from '../web/src/lib/connectionErrors';

describe('describeConnectionError', () => {
  it('returns a localized explanation for invalid tokens', () => {
    expect(describeConnectionError('INVALID_TOKEN')).toContain('無効');
  });

  it('mentions the connection cap when the limit is reached', () => {
    expect(describeConnectionError('LIMIT_REACHED')).toContain('上限');
  });

  it('falls back to a generic message', () => {
    expect(describeConnectionError('UNKNOWN')).toContain('接続');
  });
});
