import { migrateSave, type SaveData } from '../store/save';
import { hash32 } from './rng';

const PREFIX = 'SCPG1:';

/** Error de respaldo; message es una clave de traducción (backup.err.*). */
export class BackupError extends Error {
  constructor(public readonly key: string) {
    super(key);
  }
}

const toBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const fromBase64 = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/** Texto de respaldo autocontenido con suma de verificación. */
export function encodeBackup(save: SaveData): string {
  const json = JSON.stringify({ app: 'scp-gacha', exportedAt: Date.now(), save });
  return `${PREFIX}${hash32(json).toString(36)}:${toBase64(json)}`;
}

export function decodeBackup(text: string): SaveData {
  const clean = text.trim();
  if (!clean.startsWith(PREFIX)) throw new BackupError('backup.err.prefix');
  const [sum, body] = clean.slice(PREFIX.length).split(':');
  if (!sum || !body) throw new BackupError('backup.err.incomplete');
  let json: string;
  try {
    json = fromBase64(body);
  } catch {
    throw new BackupError('backup.err.base64');
  }
  if (hash32(json).toString(36) !== sum) throw new BackupError('backup.err.checksum');
  const parsed = JSON.parse(json) as { app?: string; save?: unknown };
  if (parsed.app !== 'scp-gacha' || !parsed.save) throw new BackupError('backup.err.format');
  return migrateSave(parsed.save);
}
