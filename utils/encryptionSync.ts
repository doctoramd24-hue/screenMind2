import { Note, Settings, Goal, EncryptedVaultPayload } from '../types.ts';

const PBKDF2_ITERATIONS = 100000;
const VAULT_VERSION = '1.0.0';

/**
 * Converts ArrayBuffer to Base64
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a password and salt using PBKDF2
 */
async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary data (notes, goals, settings) using AES-GCM with a user password.
 */
export async function encryptVault(
  data: { notes: Note[]; settings?: Settings; goals?: Goal[] },
  passphrase: string
): Promise<EncryptedVaultPayload> {
  if (!passphrase || passphrase.trim().length < 4) {
    throw new Error('Пароль шифрования должен содержать минимум 4 символа.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, salt);

  const jsonString = JSON.stringify(data);
  const encodedData = new TextEncoder().encode(jsonString);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  return {
    version: VAULT_VERSION,
    timestamp: new Date().toISOString(),
    salt: bufferToBase64(salt.buffer),
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(encryptedBuffer),
    noteCount: data.notes?.length || 0
  };
}

/**
 * Decrypts an EncryptedVaultPayload using the user password.
 */
export async function decryptVault(
  payload: EncryptedVaultPayload | string,
  passphrase: string
): Promise<{ notes: Note[]; settings?: Settings; goals?: Goal[] }> {
  if (!passphrase) {
    throw new Error('Не указан пароль расшифровки.');
  }

  const parsedPayload: EncryptedVaultPayload =
    typeof payload === 'string' ? JSON.parse(payload) : payload;

  if (!parsedPayload.ciphertext || !parsedPayload.iv || !parsedPayload.salt) {
    throw new Error('Некорректная структура зашифрованного файла (отсутствуют криптографические метаданные).');
  }

  const salt = new Uint8Array(base64ToBuffer(parsedPayload.salt));
  const iv = new Uint8Array(base64ToBuffer(parsedPayload.iv));
  const ciphertext = base64ToBuffer(parsedPayload.ciphertext);

  const key = await deriveEncryptionKey(passphrase, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decryptedString = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedString);
  } catch (err) {
    throw new Error('Ошибка расшифровки: Неверный пароль или поврежденные данные.');
  }
}

/**
 * Exports an encrypted .smvault backup file to the user's device
 */
export async function exportEncryptedVaultFile(
  notes: Note[],
  settings: Settings,
  goals: Goal[],
  passphrase: string
): Promise<void> {
  const payload = await encryptVault({ notes, settings, goals }, passphrase);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `ScreenMind_Encrypted_Vault_${dateStr}.smvault`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imports and decrypts a .smvault or .json file
 */
export async function importEncryptedVaultFile(
  file: File,
  passphrase: string
): Promise<{ notes: Note[]; settings?: Settings; goals?: Goal[] }> {
  const text = await file.text();
  return decryptVault(text, passphrase);
}

/**
 * WebDAV Client for Confidential Cloud Sync
 * Uploads/downloads encrypted blind blob to Nextcloud, ownCloud or WebDAV storage
 */
export async function syncWebDAV(
  url: string,
  username: string,
  password: string,
  mode: 'upload' | 'download',
  payload?: EncryptedVaultPayload
): Promise<{ success: boolean; data?: EncryptedVaultPayload; message?: string }> {
  if (!url) {
    throw new Error('Не указан WebDAV URL.');
  }

  const headers: Record<string, string> = {};
  if (username && password) {
    headers['Authorization'] = 'Basic ' + btoa(`${username}:${password}`);
  }

  if (mode === 'upload') {
    if (!payload) throw new Error('Нет данных для загрузки.');
    headers['Content-Type'] = 'application/json';

    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Ошибка WebDAV (${res.status}): ${res.statusText}`);
    }

    return { success: true, message: `Успешно выгружено ${payload.noteCount} заметок в E2EE облако.` };
  } else {
    // Download
    const res = await fetch(url, {
      method: 'GET',
      headers
    });

    if (!res.ok) {
      throw new Error(`Ошибка WebDAV скачивания (${res.status}): ${res.statusText}`);
    }

    const json = await res.json();
    return { success: true, data: json, message: 'Зашифрованный снимок успешно получен из WebDAV.' };
  }
}

/**
 * Local Encrypted Snapshots (Anti-Browser-Purge Safety Net)
 * Stores rolling AES-encrypted snapshots in localStorage under an isolated key
 */
const SNAPSHOT_KEY = 'screenmind_e2ee_snapshot';

export async function saveLocalEncryptedSnapshot(notes: Note[], passphrase: string): Promise<boolean> {
  try {
    if (!passphrase) return false;
    const payload = await encryptVault({ notes }, passphrase);
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('Failed to write encrypted snapshot:', e);
    return false;
  }
}

export async function restoreLocalEncryptedSnapshot(passphrase: string): Promise<Note[] | null> {
  const item = localStorage.getItem(SNAPSHOT_KEY);
  if (!item) return null;
  const decrypted = await decryptVault(item, passphrase);
  return decrypted.notes || null;
}
