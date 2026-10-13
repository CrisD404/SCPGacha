import { describe, expect, it } from 'vitest';
import { es } from './es';
import { en } from './en';
import { hasKey, t, useLang } from './index';
import { TROPHIES, trophyKey } from '../game/trophies';
import { MISSIONS } from '../game/missions';
import { CLASS_ORDER } from '../data/classes';
import { RARITY_ORDER } from '../data/rarity';
import { CHAPTER_COUNT } from '../game/battle';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('diccionarios', () => {
  it('ambos idiomas tienen las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('los {marcadores} coinciden entre idiomas', () => {
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]));
    }
  });

  it('las negritas **…** están balanceadas', () => {
    for (const [key, value] of [...Object.entries(es), ...Object.entries(en)]) {
      expect((value.match(/\*\*/g) ?? []).length % 2, key).toBe(0);
    }
  });

  it('todos los datos de juego tienen texto', () => {
    const keys = [
      ...TROPHIES.flatMap((tr) => [`trophy.${trophyKey(tr)}.name`, `trophy.${trophyKey(tr)}.desc`]),
      ...MISSIONS.map((m) => `mission.${m.id}`),
      ...CLASS_ORDER.flatMap((c) => [`class.${c}.name`, `class.${c}.ability`, `class.${c}.desc`]),
      ...RARITY_ORDER.flatMap((r) => [`rarity.${r}.name`, `rarity.${r}.clearance`, `rarity.${r}.clearanceName`]),
      ...(['standard', 'pity', 'thaumiel', 'o5'] as const).flatMap((p) => ['name', 'short', 'blurb', 'sub', 'title'].map((f) => `pack.${p}.${f}`)),
      ...Array.from({ length: CHAPTER_COUNT }, (_, i) => `chapter.${i + 1}`),
    ];
    for (const k of keys) expect(hasKey(k), k).toBe(true);
  });

  it('t() interpola y cambia de idioma', () => {
    useLang.getState().setLang('en');
    expect(t('battle.grade', { r: 'LR' })).toBe('Grade LR');
    expect(t('gacha.statsLine', { stamps: 3, packs: 1200 })).toBe('Stamps: 3 · Packs opened: 1,200');
    useLang.getState().setLang('es');
    expect(t('battle.grade', { r: 'LR' })).toBe('Grado LR');
  });
});
