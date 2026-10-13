import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDb } from '../data/cards';
import { RARITIES, RARITY_ORDER, rarityRank } from '../data/rarity';
import type { Rarity } from '../data/types';
import { MAX_STAMINA, normalizeStamina, nextRegenIn, openPack, REGEN_MS, rollRarity, isPityPack, packsUntilPity } from './gacha';
import { mulberry32 } from './rng';
import { makeFighter, simulateDuel, simulateRaid, simulateTeam, stageInfo, type BattleEvent } from './battle';
import { decodeBackup, encodeBackup } from './backup';
import { defaultSave } from '../store/save';
import { evaluateTrophies } from './trophies';

const db = buildDb(JSON.parse(readFileSync(new URL('../../public/data/cards.json', import.meta.url), 'utf8')));

describe('dataset', () => {
  it('tiene todas las rarezas y estadísticas dentro de rango', () => {
    expect(db.all.length).toBeGreaterThan(9000);
    for (const r of RARITY_ORDER) expect(db.byRarity[r].length).toBeGreaterThan(20);
    for (const c of db.all) {
      expect(c.atk).toBeGreaterThan(0);
      expect(c.atk).toBeLessThanOrEqual(15000);
      expect(c.def).toBeLessThanOrEqual(15000);
      expect(c.q).toBeGreaterThanOrEqual(0);
      expect(c.q).toBeLessThanOrEqual(100);
    }
  });

  it('la rareza media sube con el ATK+DEF medio', () => {
    const avg = (r: Rarity) => db.byRarity[r].reduce((s, c) => s + c.atk + c.def, 0) / db.byRarity[r].length;
    for (let i = 1; i < RARITY_ORDER.length; i++) expect(avg(RARITY_ORDER[i])).toBeGreaterThan(avg(RARITY_ORDER[i - 1]));
  });
});

describe('tiradas', () => {
  it('las probabilidades suman 1', () => {
    const total = RARITY_ORDER.reduce((s, r) => s + RARITIES[r].rate, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('rollRarity respeta las tasas (Monte Carlo)', () => {
    const rng = mulberry32(42);
    const N = 200_000;
    const counts: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const r = rollRarity(rng);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    for (const r of RARITY_ORDER) expect(counts[r] / N).toBeCloseTo(RARITIES[r].rate, 2);
  });

  it('las garantías nunca bajan del mínimo', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      expect(rarityRank(rollRarity(rng, 'SSR'))).toBeGreaterThanOrEqual(rarityRank('SSR'));
      const pack = openPack('o5', rng, db);
      expect(pack).toHaveLength(5);
      expect(rarityRank(pack[4].rarity)).toBeGreaterThanOrEqual(rarityRank('UR'));
      const pity = openPack('pity', rng, db);
      expect(pity.some((c) => rarityRank(c.rarity) >= rarityRank('SR'))).toBe(true);
    }
  });

  it('el paquete se ordena de menor a mayor rareza y sin repetidos', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const pack = openPack('standard', rng, db);
      for (let k = 1; k < pack.length; k++) expect(rarityRank(pack[k].rarity)).toBeGreaterThanOrEqual(rarityRank(pack[k - 1].rarity));
      expect(new Set(pack.map((c) => c.id)).size).toBe(5);
    }
  });

  it('la garantía SR+ llega cada 10 paquetes', () => {
    let counter = 0;
    const guaranteed: number[] = [];
    for (let p = 1; p <= 30; p++) {
      if (isPityPack(counter)) {
        guaranteed.push(p);
        counter = 0;
      } else counter++;
    }
    expect(guaranteed).toEqual([10, 20, 30]);
    expect(packsUntilPity(0)).toBe(9);
  });
});

describe('energía', () => {
  it('regenera 1 por minuto hasta el máximo y conserva el progreso parcial', () => {
    const t0 = 1_000_000;
    const s = { stamina: 3, staminaAt: t0 };
    expect(normalizeStamina(s, t0 + REGEN_MS * 2 + 5000)).toEqual({ stamina: 5, staminaAt: t0 + REGEN_MS * 2 });
    expect(nextRegenIn(s, t0 + 5000)).toBe(REGEN_MS - 5000);
    expect(normalizeStamina(s, t0 + REGEN_MS * 60).stamina).toBe(MAX_STAMINA);
    expect(nextRegenIn({ stamina: MAX_STAMINA, staminaAt: t0 }, t0 + 1)).toBeNull();
  });

  it('los paquetes extra por encima del máximo no se pierden', () => {
    expect(normalizeStamina({ stamina: 14, staminaAt: 0 }, 10 * REGEN_MS).stamina).toBe(14);
  });
});

describe('combate', () => {
  const lr = db.byRarity.LR[0];
  const c = db.byRarity.C[0];

  it('un duelo siempre termina y deja eventos coherentes', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed);
      const a = makeFighter(db.all[seed * 7], 'A', 'a');
      const b = makeFighter(db.all[seed * 13 + 1], 'B', 'b');
      const events: BattleEvent[] = [];
      const r = simulateDuel(a, b, rng, events);
      expect(r.turns).toBeLessThanOrEqual(40);
      if (r.reason === 'ko') expect(Math.min(a.hp, b.hp)).toBe(0);
      expect(events.length).toBeGreaterThan(0);
    }
  });

  it('una LR gana a una C casi siempre', () => {
    let wins = 0;
    for (let seed = 0; seed < 200; seed++) {
      const r = simulateDuel(makeFighter(lr, 'A', 'a'), makeFighter(c, 'B', 'b'), mulberry32(seed), []);
      if (r.winner?.key === 'a') wins++;
    }
    expect(wins).toBeGreaterThan(190);
  });

  it('equipos e incursión terminan', () => {
    const rng = mulberry32(99);
    const A = db.byRarity.SR.slice(0, 5).map((card, i) => makeFighter(card, 'A', `a${i}`));
    const B = db.byRarity.SR.slice(5, 10).map((card, i) => makeFighter(card, 'B', `b${i}`));
    const t = simulateTeam(A, B, rng);
    expect(['A', 'B', null]).toContain(t.winner);
    const boss = makeFighter(lr, 'B', 'boss', 1, { hp: 150000, boss: true });
    const raid = simulateRaid(db.byRarity.R.slice(0, 10).map((card, i) => makeFighter(card, 'A', `r${i}`)), boss, rng);
    expect(raid.damage).toBeGreaterThan(0);
    expect(raid.damage).toBeLessThanOrEqual(150000);
  });

  it('las operaciones de historia son deterministas', () => {
    expect(stageInfo(db, 17).enemies.map((x) => x.id)).toEqual(stageInfo(db, 17).enemies.map((x) => x.id));
    expect(stageInfo(db, 10).enemies).toHaveLength(5);
    expect(stageInfo(db, 1).enemies).toHaveLength(1);
  });
});

describe('respaldo y trofeos', () => {
  it('ida y vuelta del respaldo', () => {
    const s = defaultSave(123);
    s.collection['scp-173'] = { n: 2, first: 1, last: 2, fav: true };
    s.packsOpened = 42;
    const back = decodeBackup(encodeBackup(s));
    expect(back.collection['scp-173']).toEqual(s.collection['scp-173']);
    expect(back.packsOpened).toBe(42);
  });

  it('detecta respaldos alterados', () => {
    const text = encodeBackup(defaultSave());
    const tampered = text.slice(0, -4) + (text.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(() => decodeBackup(tampered)).toThrow();
  });

  it('desbloquea trofeos de paquete', () => {
    const s = defaultSave();
    const pack = db.byRarity.C.slice(0, 5);
    s.packsOpened = 1;
    for (const card of pack) s.collection[card.id] = { n: 1, first: 0, last: 0 };
    const ids = evaluateTrophies(s, db, { type: 'pack', cards: pack }).map((t) => t.id);
    expect(ids).toContain('pulls_1');
    expect(ids).toContain('pack_allc');
  });
});
