// Phase 40: transparent token encryption helpers.
// Wearable tokens (Oura PAT, Withings access/refresh) are stored encrypted
// with the same AES-256-GCM scheme as the BYOK Anthropic key. These helpers
// let call sites read/write tokens without caring whether a value is a
// legacy plaintext token or a "v1:" ciphertext — enabling a lazy migration.
import { encrypt, decrypt } from "./crypto-util";

export function isEncryptedToken(stored?: string | null): boolean {
  return typeof stored === "string" && stored.startsWith("v1:");
}

// Decrypt a stored token. Legacy plaintext values pass through unchanged.
// Returns null on decryption failure (caller should treat as disconnected).
export function readToken(stored?: string | null): string | null {
  if (!stored || typeof stored !== "string") return null;
  if (!stored.startsWith("v1:")) return stored; // legacy plaintext
  try {
    return decrypt(stored);
  } catch {
    return null;
  }
}

// Encrypt a plaintext token for storage.
export function writeToken(plain: string): string {
  return encrypt(plain);
}
