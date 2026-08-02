// In-memory encryption key store (never persisted to localStorage for security)
// Key is derived at login/register and held during the session.

import { encryptMessage, decryptMessage } from '../services/crypto';

let aesKey: CryptoKey | null = null;

export function setEncryptionKey(key: CryptoKey | null) {
  aesKey = key;
}

export function getEncryptionKey(): CryptoKey | null {
  return aesKey;
}

export async function encryptContent(plaintext: string): Promise<{ content: string; iv: string }> {
  if (!aesKey) {
    // No encryption key — send as plaintext (backward compatible)
    return { content: plaintext, iv: '' };
  }
  return encryptMessage(aesKey, plaintext);
}

export async function decryptContent(ciphertext: string, iv: string): Promise<string> {
  if (!aesKey || !iv) {
    // No encryption or no IV — return as-is
    return ciphertext;
  }
  try {
    return await decryptMessage(aesKey, ciphertext, iv);
  } catch {
    // Decryption failed — might be legacy plaintext or wrong key
    return ciphertext;
  }
}
