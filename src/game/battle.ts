import type { Card, ObjClass, Rarity } from '../data/types';
import { RARITY_ORDER, rarityRank } from '../data/rarity';
import type { CardDb } from '../data/cards';
import { hash32, mulberry32, pick, range, type Rng } from './rng';

export const DUEL_MAX_TURNS = 40;
export const HP_BASE = 3000;
export const MAX_LEVEL = 30;

export interface Fighter {
  key: string;
  card: Card;
  side: 'A' | 'B';
  level: number;
  atk: number;
  def: number;
  maxHp: number;
  hp: number;
  turns: number;
  lastStandUsed: boolean;
  boss?: boolean;
}

export type BattleEvent =
  | { kind: 'enter'; a: string; b: string }
  | { kind: 'hit'; turn: number; from: string; to: string; dmg: number; crit: boolean; extra: boolean; hp: number }
  | { kind: 'miss'; turn: number; from: string; to: string }
  | { kind: 'heal'; turn: number; who: string; amount: number; hp: number }
  | { kind: 'laststand'; turn: number; who: string }
  | { kind: 'ko'; turn: number; who: string }
  | { kind: 'decision'; turn: number; winner: string | null };

const CLASS_MODS: Partial<Record<ObjClass, { atk?: number; def?: number; hp?: number }>> = {
  pending: { atk: 1.08, def: 1.08 },
  archon: { atk: 1.1 },
  decommissioned: { atk: 1.2, hp: 0.9 },
};

export const levelMult = (level: number) => 1 + 0.04 * (Math.min(MAX_LEVEL, Math.max(1, level)) - 1);

export function makeFighter(card: Card, side: 'A' | 'B', key: string, level = 1, opts: { hp?: number; atkMult?: number; boss?: boolean } = {}): Fighter {
  const mods = CLASS_MODS[card.cls] ?? {};
  const lm = levelMult(level);
  const atk = Math.round(card.atk * lm * (mods.atk ?? 1) * (opts.atkMult ?? 1));
  const def = Math.round(card.def * lm * (mods.def ?? 1));
  const maxHp = opts.hp ?? Math.round((def + HP_BASE) * (mods.hp ?? 1));
  return { key, card, side, level, atk, def, maxHp, hp: maxHp, turns: 0, lastStandUsed: false, boss: opts.boss };
}

/** Un turno de ataque de `att` sobre `tgt`, aplicando las habilidades de clase. */
export function performAttack(att: Fighter, tgt: Fighter, rng: Rng, turn: number, events: BattleEvent[]) {
  att.turns++;
  if (att.card.cls === 'thaumiel' && att.turns % 4 === 0 && att.hp < att.maxHp) {
    const amount = Math.min(att.maxHp - att.hp, Math.round(att.maxHp * 0.12));
    att.hp += amount;
    events.push({ kind: 'heal', turn, who: att.key, amount, hp: att.hp });
  }
  const hits = att.card.cls === 'esoteric' && rng() < 0.25 ? 2 : 1;
  for (let h = 0; h < hits && tgt.hp > 0; h++) {
    const evade = att.card.cls === 'explained' ? 0 : tgt.card.cls === 'euclid' ? 0.15 : tgt.card.cls === 'archon' ? 0.1 : 0;
    if (evade > 0 && rng() < evade) {
      events.push({ kind: 'miss', turn, from: att.key, to: tgt.key });
      continue;
    }
    let dmg = att.atk * range(rng, 0.14, 0.18);
    if (att.card.cls === 'apollyon') dmg *= 1.15;
    else dmg *= 1 - tgt.def / (tgt.def + 20000);
    if (tgt.card.cls === 'safe') dmg *= 0.85;
    const critChance = tgt.card.cls === 'explained' ? 0 : 0.08 + (att.card.cls === 'keter' ? 0.12 : 0);
    const crit = rng() < critChance;
    if (crit) dmg *= 1.6;
    const final = Math.max(1, Math.round(dmg));
    tgt.hp -= final;
    let lastStand = false;
    if (tgt.hp <= 0 && tgt.card.cls === 'neutralized' && !tgt.lastStandUsed) {
      tgt.hp = 1;
      tgt.lastStandUsed = true;
      lastStand = true;
    }
    tgt.hp = Math.max(0, tgt.hp);
    events.push({ kind: 'hit', turn, from: att.key, to: tgt.key, dmg: final, crit, extra: h > 0, hp: tgt.hp });
    if (lastStand) events.push({ kind: 'laststand', turn, who: tgt.key });
    if (tgt.hp === 0) events.push({ kind: 'ko', turn, who: tgt.key });
  }
}

export interface DuelResult {
  winner: Fighter | null;
  reason: 'ko' | 'decision';
  turns: number;
}

export function simulateDuel(a: Fighter, b: Fighter, rng: Rng, events: BattleEvent[], maxTurns = DUEL_MAX_TURNS): DuelResult {
  const first = rng() < 0.5 ? a : b;
  const second = first === a ? b : a;
  for (let turn = 1; turn <= maxTurns; turn++) {
    const att = turn % 2 === 1 ? first : second;
    const tgt = att === first ? second : first;
    performAttack(att, tgt, rng, turn, events);
    if (tgt.hp <= 0) return { winner: att, reason: 'ko', turns: turn };
  }
  const ra = a.hp / a.maxHp;
  const rb = b.hp / b.maxHp;
  const winner = ra === rb ? null : ra > rb ? a : b;
  events.push({ kind: 'decision', turn: maxTurns, winner: winner?.key ?? null });
  return { winner, reason: 'decision', turns: maxTurns };
}

export interface TeamResult {
  winner: 'A' | 'B' | null;
  events: BattleEvent[];
  fighters: Fighter[];
}

/** Combate por equipos: el primero en pie de cada lado se enfrenta; el ganador conserva su HP. */
export function simulateTeam(teamA: Fighter[], teamB: Fighter[], rng: Rng): TeamResult {
  const events: BattleEvent[] = [];
  let i = 0;
  let j = 0;
  while (i < teamA.length && j < teamB.length) {
    const a = teamA[i];
    const b = teamB[j];
    events.push({ kind: 'enter', a: a.key, b: b.key });
    const r = simulateDuel(a, b, rng, events);
    if (r.winner === a) {
      if (b.hp > 0) b.hp = 0;
      j++;
    } else if (r.winner === b) {
      if (a.hp > 0) a.hp = 0;
      i++;
    } else {
      i++;
      j++;
    }
  }
  const winner = i < teamA.length ? 'A' : j < teamB.length ? 'B' : null;
  return { winner, events, fighters: [...teamA, ...teamB] };
}

// ───────────────────────────── Brecha diaria (incursión) ─────────────────────────────

export const RAID_TURNS_PER_CARD = 12;
export const RAID_ATTEMPTS_PER_DAY = 3;
export const RAID_MAX_CARDS = 10;

export const RAID_BOSSES = ['SCP-682', 'SCP-106', 'SCP-096', 'SCP-173', 'SCP-049', 'SCP-939', 'SCP-610', 'SCP-3000', 'SCP-076', 'SCP-035', 'SCP-2845', 'SCP-001', 'SCP-6820', 'SCP-5031'];

export function raidBossFor(db: CardDb, index: number): Card {
  const list = RAID_BOSSES.map((code) => db.all.find((c) => c.code === code)).filter((c): c is Card => !!c);
  return list.length ? list[index % list.length] : db.byRarity.LR[index % db.byRarity.LR.length];
}

export const raidBossHp = (defeatedSoFar: number) => Math.round(150_000 * (1 + 0.25 * Math.min(defeatedSoFar, 12)));

export interface RaidAttempt {
  events: BattleEvent[];
  damage: number;
  fighters: Fighter[];
  boss: Fighter;
}

export function simulateRaid(team: Fighter[], boss: Fighter, rng: Rng): RaidAttempt {
  const events: BattleEvent[] = [];
  const start = boss.hp;
  let turn = 0;
  for (const f of team) {
    if (boss.hp <= 0) break;
    events.push({ kind: 'enter', a: f.key, b: boss.key });
    for (let t = 0; t < RAID_TURNS_PER_CARD && boss.hp > 0 && f.hp > 0; t++) {
      performAttack(f, boss, rng, ++turn, events);
      if (boss.hp <= 0) break;
      performAttack(boss, f, rng, ++turn, events);
    }
  }
  return { events, damage: start - boss.hp, fighters: team, boss };
}

// ───────────────────────────── Recontención (historia) ─────────────────────────────

export const STORY_STAGES = 100;

/** 10 capítulos de 10 operaciones; los nombres están en src/i18n (chapter.<n>). */
export const CHAPTER_COUNT = 10;

const CHAPTER_GRADE: Rarity[] = ['C', 'UC', 'R', 'SR', 'SR', 'SSR', 'SSR', 'UR', 'UR', 'LR'];

export interface StageInfo {
  n: number;
  chapter: number;
  boss: boolean;
  enemyLevel: number;
  enemies: Card[];
  xp: number;
}

export function stageInfo(db: CardDb, n: number): StageInfo {
  const chapter = Math.ceil(n / 10);
  const inChapter = ((n - 1) % 10) + 1;
  const boss = inChapter === 10;
  const grade = CHAPTER_GRADE[Math.min(chapter, CHAPTER_GRADE.length) - 1];
  const rng = mulberry32(hash32(`stage:${n}`));
  const count = boss ? 5 : 1 + Math.min(4, Math.floor((inChapter - 1) / 2));
  const enemies: Card[] = [];
  for (let i = 0; i < count; i++) {
    const g = boss && i === count - 1 ? RARITY_ORDER[Math.min(6, rarityRank(grade) + 1)] : rng() < 0.3 ? RARITY_ORDER[Math.max(0, rarityRank(grade) - 1)] : grade;
    enemies.push(pick(rng, db.byRarity[g]));
  }
  return {
    n,
    chapter,
    boss,
    enemyLevel: 1 + Math.floor((n - 1) / 4),
    enemies,
    xp: 30 + 10 * n,
  };
}

/** Coste en Conocimiento de subir del nivel `level` al siguiente. */
export const levelUpCost = (level: number) => 40 * level;

// ───────────────────────────── Oponentes ─────────────────────────────

export function randomOpponent(db: CardDb, grade: Rarity, rng: Rng, avoid?: string): Card {
  const pool = db.byRarity[grade];
  let c = pick(rng, pool);
  for (let k = 0; k < 5 && c.id === avoid; k++) c = pick(rng, pool);
  return c;
}

export function randomTeam(db: CardDb, grade: Rarity, rng: Rng, size = 5): Card[] {
  const used = new Set<string>();
  const out: Card[] = [];
  while (out.length < size) {
    const c = pick(rng, db.byRarity[grade]);
    if (used.has(c.id) && db.byRarity[grade].length > size) continue;
    used.add(c.id);
    out.push(c);
  }
  return out;
}
