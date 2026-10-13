import { EncryptedNoteBundle } from '@/types/note';

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface DecryptedNotePayload {
  title: string;
  content: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  todos?: any[];
  images?: string[];
}

/**
 * Encrypts a note's sensitive payload (title, content, todos, images) using AES-256-GCM + PBKDF2
 */
export async function encryptNote(
  payload: DecryptedNotePayload,
  password: string,
  hint?: string
): Promise<EncryptedNoteBundle> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Cryptography API is not available in this environment');
  }

  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const plainBytes = enc.encode(JSON.stringify(payload));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plainBytes
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv),
    salt: bufferToBase64(salt),
    hint: hint?.trim() || undefined,
    timestamp: Date.now(),
  };
}

/**
 * Decrypts a note bundle with the password using AES-256-GCM + PBKDF2
 */
export async function decryptNote(
  bundle: EncryptedNoteBundle,
  password: string
): Promise<DecryptedNotePayload> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Cryptography API is not available in this environment');
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = base64ToBuffer(bundle.salt);
  const iv = base64ToBuffer(bundle.iv);
  const cipherBytes = base64ToBuffer(bundle.ciphertext);

  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  try {
    const plainBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      aesKey,
      cipherBytes
    );

    const jsonStr = dec.decode(plainBuffer);
    return JSON.parse(jsonStr) as DecryptedNotePayload;
  } catch (err) {
    throw new Error('Incorrect password or corrupted note data');
  }
}
