import type { Card, ObjClass, PackType, Rarity } from '../data/types';
import { trophyKey, type TrophyDef } from '../game/trophies';
import { hasKey, t, tk } from './index';

/** Etiquetas visibles derivadas de los datos de juego. */

export const rarityName = (r: Rarity) => tk(`rarity.${r}.name`);
export const clearance = (r: Rarity) => tk(`rarity.${r}.clearance`);
export const clearanceName = (r: Rarity) => tk(`rarity.${r}.clearanceName`);

export const className = (c: ObjClass) => tk(`class.${c}.name`);
export const classAbility = (c: ObjClass) => tk(`class.${c}.ability`);
export const classAbilityDesc = (c: ObjClass) => tk(`class.${c}.desc`);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Clase tal como se muestra en la carta (las esotéricas usan su nombre propio). */
export function classLabel(card: Pick<Card, 'cls' | 'clsLabel'>): string {
  if (card.cls === 'esoteric' && card.clsLabel) {
    const key = `eso.${card.clsLabel}`;
    return hasKey(key) ? t(key) : capitalize(card.clsLabel);
  }
  return className(card.cls);
}

export const packName = (p: PackType) => tk(`pack.${p}.name`);
export const packShort = (p: PackType) => tk(`pack.${p}.short`);
export const packBlurb = (p: PackType) => tk(`pack.${p}.blurb`);
export const packSub = (p: PackType) => tk(`pack.${p}.sub`);
export const packTitle = (p: PackType) => tk(`pack.${p}.title`);

export const trophyName = (tr: TrophyDef) => tk(`trophy.${trophyKey(tr)}.name`, tr.params);
export const trophyDesc = (tr: TrophyDef) => tk(`trophy.${trophyKey(tr)}.desc`, tr.params);

export const chapterName =(n: number) => tk(`chapter.${Math.min(10, Math.max(1, n))}`);

export function seriesLabel(s: string): string {
  const m = s.match(/^series-(\d+)/);
  if (m) return t('series.n', { n: m[1] });
  const key = `series.${s}`;
  return hasKey(key) ? t(key) : s;
}
