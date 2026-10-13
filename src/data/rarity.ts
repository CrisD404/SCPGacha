import type { Rarity } from './types';

export interface RarityInfo {
  id: Rarity;
  rank: number;
  /** probabilidad por carta en un paquete estándar */
  rate: number;
  /** percentil mínimo del Índice de Notoriedad */
  minQ: number;
  color: string;
  glow: string;
  /** nivel de dramatismo de la animación de revelado (0–5) */
  drama: number;
}

export const RARITY_ORDER: Rarity[] = ['C', 'UC', 'R', 'SR', 'SSR', 'UR', 'LR'];

// Los nombres visibles (rareza y nivel de autorización) están en src/i18n.
export const RARITIES: Record<Rarity, RarityInfo> = {
  C: { id: 'C', rank: 0, rate: 0.465, minQ: 0, color: '#9aa3b2', glow: 'rgba(154,163,178,.45)', drama: 0 },
  UC: { id: 'UC', rank: 1, rate: 0.3, minQ: 34, color: '#43d39e', glow: 'rgba(67,211,158,.5)', drama: 0 },
  R: { id: 'R', rank: 2, rate: 0.15, minQ: 64, color: '#4ea8ff', glow: 'rgba(78,168,255,.55)', drama: 1 },
  SR: { id: 'SR', rank: 3, rate: 0.06, minQ: 84, color: '#b57bff', glow: 'rgba(181,123,255,.6)', drama: 2 },
  SSR: { id: 'SSR', rank: 4, rate: 0.019, minQ: 94, color: '#ff4d5e', glow: 'rgba(255,77,94,.65)', drama: 3 },
  UR: { id: 'UR', rank: 5, rate: 0.005, minQ: 98, color: '#ffc845', glow: 'rgba(255,200,69,.7)', drama: 4 },
  LR: { id: 'LR', rank: 6, rate: 0.001, minQ: 99.5, color: '#ff8cf0', glow: 'rgba(255,140,240,.75)', drama: 5 },
};

export const rarityRank = (r: Rarity) => RARITIES[r].rank;
export const atLeast = (r: Rarity, min: Rarity) => rarityRank(r) >= rarityRank(min);
export const maxRarity = (list: Rarity[]): Rarity =>
  list.reduce<Rarity>((best, r) => (rarityRank(r) > rarityRank(best) ? r : best), 'C');

export const formatPct = (p: number, locale = 'en-US') => {
  const v = p * 100;
  const digits = v >= 1 ? 1 : 2;
  return `${v.toLocaleString(locale, { maximumFractionDigits: digits })}%`;
};
