import { Note, Settings, Goal, AIProfile } from '../types.ts';

const DB_ENCRYPTION_SESSION_KEY = 'screenmind_db_passphrase_session';
const PBKDF2_ITERATIONS = 100000;

export interface EncryptedContainer {
  __encrypted: true;
  salt: string; // Base64
  iv: string;   // Base64
  ciphertext: string; // Base64
  timestamp: string;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
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

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
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
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

class CryptoLayerService {
  private static instance: CryptoLayerService;
  private currentPassphrase: string | null = null;
  private isUnlocked = false;

  private constructor() {
    // Restore session passphrase from sessionStorage (memory only during browser tab life)
    const sessionPass = sessionStorage.getItem(DB_ENCRYPTION_SESSION_KEY);
    if (sessionPass) {
      this.currentPassphrase = sessionPass;
      this.isUnlocked = true;
    }
  }

  public static getInstance(): CryptoLayerService {
    if (!CryptoLayerService.instance) {
      CryptoLayerService.instance = new CryptoLayerService();
    }
    return CryptoLayerService.instance;
  }

  public setPassphrase(passphrase: string, persistSession = true): void {
    this.currentPassphrase = passphrase.trim();
    this.isUnlocked = !!passphrase;
    if (persistSession && passphrase) {
      sessionStorage.setItem(DB_ENCRYPTION_SESSION_KEY, passphrase);
    } else {
      sessionStorage.removeItem(DB_ENCRYPTION_SESSION_KEY);
    }
  }

  public getPassphrase(): string | null {
    return this.currentPassphrase;
  }

  public isVaultUnlocked(): boolean {
    return this.isUnlocked && !!this.currentPassphrase;
  }

  public lock(): void {
    this.currentPassphrase = null;
    this.isUnlocked = false;
    sessionStorage.removeItem(DB_ENCRYPTION_SESSION_KEY);
  }

  public isEncryptedContainer(data: any): data is EncryptedContainer {
    return data && typeof data === 'object' && data.__encrypted === true && !!data.ciphertext;
  }

  /**
   * Encrypts any data payload into an AES-GCM EncryptedContainer
   */
  public async encrypt<T = any>(data: T): Promise<EncryptedContainer | T> {
    if (!this.currentPassphrase) {
      // Not encrypted
      return data;
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(this.currentPassphrase, salt);

    const jsonStr = JSON.stringify(data);
    const encoded = new TextEncoder().encode(jsonStr);

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    return {
      __encrypted: true,
      salt: bufferToBase64(salt.buffer),
      iv: bufferToBase64(iv.buffer),
      ciphertext: bufferToBase64(encryptedBuffer),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Decrypts an EncryptedContainer back into raw typed object
   */
  public async decrypt<T = any>(data: any): Promise<{ data: T; wasEncrypted: boolean; error?: string }> {
    if (!this.isEncryptedContainer(data)) {
      return { data: data as T, wasEncrypted: false };
    }

    if (!this.currentPassphrase) {
      return { 
        data: null as any, 
        wasEncrypted: true, 
        error: 'База зашифрована. Введите PIN-код или пароль для разблокировки.' 
      };
    }

    try {
      const salt = new Uint8Array(base64ToBuffer(data.salt));
      const iv = new Uint8Array(base64ToBuffer(data.iv));
      const ciphertext = base64ToBuffer(data.ciphertext);
      const key = await deriveKey(this.currentPassphrase, salt);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );

      const decodedStr = new TextDecoder().decode(decryptedBuffer);
      return { data: JSON.parse(decodedStr) as T, wasEncrypted: true };
    } catch (err: any) {
      return { 
        data: null as any, 
        wasEncrypted: true, 
        error: 'Неверный PIN-код или поврежденные криптографические данные.' 
      };
    }
  }
}

export const cryptoLayer = CryptoLayerService.getInstance();
