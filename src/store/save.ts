import type { Rarity } from '../data/types';
import { MAX_STAMINA } from '../game/gacha';

export type MissionId = 'open5' | 'srplus' | 'read' | 'share' | 'win';

export interface OwnedCard {
  /** copias */
  n: number;
  /** primera obtención (ms) */
  first: number;
  /** última obtención (ms) */
  last: number;
  fav?: boolean;
}

export interface RaidState {
  date: string;
  bossId: string;
  hp: number;
  maxHp: number;
  attempts: number;
  defeated: boolean;
  bestHit: number;
}

export interface StoryState {
  /** etapa más alta superada (0 = ninguna) */
  cleared: number;
  /** Conocimiento acumulado (moneda para subir de nivel) */
  xp: number;
  squad: string[];
  levels: Record<string, number>;
}

export interface BattleRecord {
  at: number;
  mode: 'single' | 'team' | 'raid' | 'story';
  result: 'win' | 'loss' | 'draw';
  cards: string[];
  /** datos para armar el resumen en el idioma activo */
  grade?: Rarity;
  rival?: string;
  damage?: number;
  stage?: number;
  /** resumen ya redactado (registros de versiones anteriores) */
  summary?: string;
}

export interface Settings {
  intense: boolean;
  sound: boolean;
  volume: number;
  battleSpeed: number;
  hideRules: boolean;
}

export interface SaveData {
  version: 1;
  createdAt: number;
  stamina: number;
  staminaAt: number;
  bonus: { thaumiel: number; o5: number };
  pityCounter: number;
  packsOpened: number;
  cardsPulled: number;
  pulledByRarity: Record<Rarity, number>;
  collection: Record<string, OwnedCard>;
  daily: { date: string; progress: Record<MissionId, number>; done: MissionId[] };
  login: { lastDate: string; stamps: number };
  trophies: Record<string, number>;
  counters: {
    shares: number;
    reads: number;
    battlesWon: number;
    battlesPlayed: number;
    upsets: number;
    teamWins: Partial<Record<Rarity, number>>;
    raidsDefeated: number;
    missionsCompleted: number;
    perfectDays: number;
  };
  raid: RaidState | null;
  story: StoryState;
  battleLog: BattleRecord[];
  settings: Settings;
}

export const emptyRarityCount = (): Record<Rarity, number> => ({ C: 0, UC: 0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 0 });

export const emptyProgress = (): Record<MissionId, number> => ({ open5: 0, srplus: 0, read: 0, share: 0, win: 0 });

export function defaultSave(now = Date.now()): SaveData {
  return {
    version: 1,
    createdAt: now,
    stamina: MAX_STAMINA,
    staminaAt: now,
    bonus: { thaumiel: 0, o5: 0 },
    pityCounter: 0,
    packsOpened: 0,
    cardsPulled: 0,
    pulledByRarity: emptyRarityCount(),
    collection: {},
    daily: { date: '', progress: emptyProgress(), done: [] },
    login: { lastDate: '', stamps: 0 },
    trophies: {},
    counters: { shares: 0, reads: 0, battlesWon: 0, battlesPlayed: 0, upsets: 0, teamWins: {}, raidsDefeated: 0, missionsCompleted: 0, perfectDays: 0 },
    raid: null,
    story: { cleared: 0, xp: 0, squad: [], levels: {} },
    battleLog: [],
    settings: { intense: true, sound: true, volume: 0.7, battleSpeed: 1, hideRules: false },
  };
}

/** Rellena campos que falten (partidas guardadas por versiones anteriores o importadas). */
export function migrateSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  return {
    ...base,
    ...r,
    version: 1,
    bonus: { ...base.bonus, ...r.bonus },
    pulledByRarity: { ...base.pulledByRarity, ...r.pulledByRarity },
    collection: r.collection ?? {},
    daily: { ...base.daily, ...r.daily, progress: { ...base.daily.progress, ...r.daily?.progress } },
    login: { ...base.login, ...r.login },
    trophies: r.trophies ?? {},
    counters: { ...base.counters, ...r.counters, teamWins: { ...r.counters?.teamWins } },
    story: { ...base.story, ...r.story, levels: { ...r.story?.levels } },
    battleLog: r.battleLog ?? [],
    settings: { ...base.settings, ...r.settings },
  };
}

/** Fecha local YYYY-MM-DD (los reinicios diarios ocurren a medianoche local). */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function msUntilMidnight(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}
