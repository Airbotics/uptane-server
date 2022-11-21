import { createHash } from 'crypto';

interface IGenerateHashOpts {
    algorithm: 'SHA256' | 'SHA512';
}

/**
 * Generates a hash over `payload` using sha256 or sha512.
 */
export const generateHash = (payload: string, { algorithm }: IGenerateHashOpts): string => createHash(algorithm).update(payload, 'binary').digest('hex');