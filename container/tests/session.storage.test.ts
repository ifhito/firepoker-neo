import { describe, expect, it, vi } from 'vitest';
import { buildSessionEntryPath, persistSessionIdentity } from '@/lib/sessionStorage';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('sessionStorage helpers', () => {
  it('persists session identity into storage using the expected key', () => {
    const storage = new MemoryStorage();
    persistSessionIdentity(
      'sess_test',
      {
        userId: 'user_123',
        name: 'Tester',
        joinToken: 'join_token_abc',
      },
      storage,
    );

    const stored = storage.getItem('firepocker-session-sess_test');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({
      userId: 'user_123',
      name: 'Tester',
      joinToken: 'join_token_abc',
    });
  });

  it('does not throw when storage write fails', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage: Storage = {
      setItem: () => {
        throw new Error('boom');
      },
      getItem: () => null,
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    };

    expect(() =>
      persistSessionIdentity(
        'sess_fail',
        { userId: 'user', name: 'Name', joinToken: 'token' },
        storage,
      ),
    ).not.toThrow();
    warnSpy.mockRestore();
  });

  it('builds a session entry path including join token', () => {
    expect(buildSessionEntryPath('sess_abc', 'token_xyz')).toBe('/session/sess_abc?token=token_xyz');
  });
});
