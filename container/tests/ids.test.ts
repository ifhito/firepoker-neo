import { describe, it, expect } from 'vitest';
import { generateSessionId, generateJoinToken, generateUserId } from '@/lib/ids';

describe('ID Generators', () => {
  describe('generateSessionId', () => {
    it('should generate session ID with sess_ prefix', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^sess_[0-9a-z]{12}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });

    it('should always generate 17 characters total (sess_ + 12 chars)', () => {
      const id = generateSessionId();
      expect(id.length).toBe(17);
    });
  });

  describe('generateJoinToken', () => {
    it('should generate 24 character token', () => {
      const token = generateJoinToken();
      expect(token).toHaveLength(24);
      expect(token).toMatch(/^[a-zA-Z0-9]{24}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateJoinToken();
      const token2 = generateJoinToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateUserId', () => {
    it('should generate user ID with user_ prefix', () => {
      const id = generateUserId();
      expect(id).toMatch(/^user_[0-9a-z]{16}$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateUserId();
      const id2 = generateUserId();
      expect(id1).not.toBe(id2);
    });

    it('should always generate 21 characters total (user_ + 16 chars)', () => {
      const id = generateUserId();
      expect(id.length).toBe(21);
    });
  });
});
