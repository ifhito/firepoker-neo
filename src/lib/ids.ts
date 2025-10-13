import { customAlphabet } from 'nanoid/non-secure';

const SESSION_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const sessionIdGenerator = customAlphabet(SESSION_ALPHABET, 12);

export const generateSessionId = () => `sess_${sessionIdGenerator()}`;

const tokenGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 24);

export const generateJoinToken = () => tokenGenerator();

// ユーザーID生成用のジェネレータ
const userIdGenerator = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

export const generateUserId = () => `user_${userIdGenerator()}`;
