import type { Card, PackType, Rarity } from '../data/types';
import { RARITIES, RARITY_ORDER, rarityRank } from '../data/rarity';
import type { CardDb } from '../data/cards';
import type { Rng } from './rng';

export const PACK_SIZE = 5;
export const MAX_STAMINA = 10;
export const REGEN_MS = 60_000;
/** Cada 10 paquetes de energía, el décimo garantiza SR+. */
export const PITY_EVERY = 10;
/** Cada 100 paquetes abiertos se regala un Paquete Thaumiel. */
export const THAUMIEL_EVERY = 100;
/** Cada 5 sellos de inicio de sesión, el regalo diario es un Paquete O5. */
export const O5_EVERY_STAMPS = 5;
export const MISSION_REWARD = 2;

export interface PackInfo {
  type: PackType;
  guarantee: Rarity | null;
}

// Nombres y descripciones visibles: src/i18n (pack.<tipo>.*).
export const PACKS: Record<PackType, PackInfo> = {
  standard: { type: 'standard', guarantee: null },
  pity: { type: 'pity', guarantee: 'SR' },
  thaumiel: { type: 'thaumiel', guarantee: 'SSR' },
  o5: { type: 'o5', guarantee: 'UR' },
};

/** Tira una rareza según las probabilidades, opcionalmente con un mínimo garantizado. */
export function rollRarity(rng: Rng, min: Rarity = 'C'): Rarity {
  const pool = RARITY_ORDER.filter((r) => rarityRank(r) >= rarityRank(min));
  const total = pool.reduce((s, r) => s + RARITIES[r].rate, 0);
  let x = rng() * total;
  for (const r of pool) {
    x -= RARITIES[r].rate;
    if (x < 0) return r;
  }
  return pool[pool.length - 1];
}

/** Probabilidad efectiva de cada rareza en el espacio garantizado. */
export function guaranteedRates(min: Rarity): Partial<Record<Rarity, number>> {
  const pool = RARITY_ORDER.filter((r) => rarityRank(r) >= rarityRank(min));
  const total = pool.reduce((s, r) => s + RARITIES[r].rate, 0);
  return Object.fromEntries(pool.map((r) => [r, RARITIES[r].rate / total]));
}

export function openPack(type: PackType, rng: Rng, db: CardDb): Card[] {
  const guarantee = PACKS[type].guarantee;
  const rarities: Rarity[] = [];
  for (let i = 0; i < PACK_SIZE; i++) {
    rarities.push(guarantee && i === PACK_SIZE - 1 ? rollRarity(rng, guarantee) : rollRarity(rng));
  }
  const used = new Set<string>();
  const result = rarities.map((r) => {
    const pool = db.byRarity[r];
    let card = pool[Math.floor(rng() * pool.length)];
    for (let tries = 0; used.has(card.id) && tries < 8; tries++) card = pool[Math.floor(rng() * pool.length)];
    used.add(card.id);
    return card;
  });
  // La carta más rara siempre se revela al final.
  return result.sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
}

// ───────────────────────────── energía (paquetes diarios) ─────────────────────────────

export interface StaminaState {
  stamina: number;
  staminaAt: number;
}

/** Aplica la regeneración pendiente conservando el progreso parcial del temporizador. */
export function normalizeStamina({ stamina, staminaAt }: StaminaState, now: number): StaminaState {
  if (stamina >= MAX_STAMINA) return { stamina, staminaAt: now };
  const gained = Math.max(0, Math.floor((now - staminaAt) / REGEN_MS));
  if (stamina + gained >= MAX_STAMINA) return { stamina: MAX_STAMINA, staminaAt: now };
  return { stamina: stamina + gained, staminaAt: staminaAt + gained * REGEN_MS };
}

/** Milisegundos hasta el siguiente paquete regenerado (null si está lleno). */
export function nextRegenIn(state: StaminaState, now: number): number | null {
  const n = normalizeStamina(state, now);
  if (n.stamina >= MAX_STAMINA) return null;
  return REGEN_MS - ((now - n.staminaAt) % REGEN_MS);
}

export const isPityPack = (pityCounter: number) => pityCounter >= PITY_EVERY - 1;
export const packsUntilPity = (pityCounter: number) => Math.max(0, PITY_EVERY - 1 - pityCounter);
