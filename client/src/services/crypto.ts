// ===== End-to-End Encryption Service =====
// Architecture: One AES-256-GCM key per user.
// - Key is generated at registration
// - Key is encrypted with PBKDF2(password) and stored on server
// - At login, key is downloaded and decrypted with password
// - All messages are encrypted/decrypted with this key

const ALGORITHM = { name: 'AES-GCM', length: 256 } as const;
const PBKDF2_SALT = new TextEncoder().encode('vibelink-pbkdf2-salt-v1');

// ---- AES Key Generation ----

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(ALGORITHM, true, ['encrypt', 'decrypt']);
}

// ---- Export/Import AES Key as Raw Base64 ----

async function exportAesKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

async function importAesKey(base64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', raw, ALGORITHM, true, ['encrypt', 'decrypt']);
}

// ---- Encrypt/Decrypt AES Key with Password (PBKDF2) ----

// Derive a wrapping key from the user's password
async function deriveKeyFromPassword(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder().encode(password);
  const ikm = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: PBKDF2_SALT, iterations: 100000, hash: 'SHA-256' },
    ikm,
    ALGORITHM,
    false,
    ['encrypt', 'decrypt'],
  );
}

// Encrypt the AES key with PBKDF2(password) for server storage
export async function encryptKeyWithPassword(key: CryptoKey, password: string): Promise<string> {
  const wrappingKey = await deriveKeyFromPassword(password);
  const rawKey = await crypto.subtle.exportKey('raw', key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    rawKey,
  );
  // Prepend iv to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

// Decrypt the AES key with PBKDF2(password)
export async function decryptKeyWithPassword(encryptedBase64: string, password: string): Promise<CryptoKey> {
  const wrappingKey = await deriveKeyFromPassword(password);
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const rawKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    ciphertext,
  );
  return crypto.subtle.importKey('raw', rawKey, ALGORITHM, true, ['encrypt', 'decrypt']);
}

// ---- Encrypt/Decrypt Messages ----

export async function encryptMessage(key: CryptoKey, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptMessage(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const ct = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const ivArr = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivArr },
    key,
    ct,
  );
  return new TextDecoder().decode(decrypted);
}

// ---- Local storage of AES key for "Remember Me" ----

const LOCAL_KEY_STORAGE = 'vibelink_enc_key';

export function storeKeyLocally(key: CryptoKey): void {
  exportAesKey(key).then((base64) => {
    localStorage.setItem(LOCAL_KEY_STORAGE, base64);
  });
}

export async function loadKeyLocally(): Promise<CryptoKey | null> {
  const base64 = localStorage.getItem(LOCAL_KEY_STORAGE);
  if (!base64) return null;
  try {
    return await importAesKey(base64);
  } catch {
    localStorage.removeItem(LOCAL_KEY_STORAGE);
    return null;
  }
}

export function clearLocalKey(): void {
  localStorage.removeItem(LOCAL_KEY_STORAGE);
}
