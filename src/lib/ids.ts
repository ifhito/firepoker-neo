import { customAlphabet } from 'nanoid/non-secure';

const SESSION_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const sessionIdGenerator = customAlphabet(SESSION_ALPHABET, 12);

export const generateSessionId = () => `sess_${sessionIdGenerator()}`;

const tokenGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 24);

export const generateJoinToken = () => tokenGenerator();
