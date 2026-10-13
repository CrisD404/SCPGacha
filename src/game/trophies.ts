import type { Card, ObjClass, Rarity } from '../data/types';
import type { CardDb } from '../data/cards';
import type { SaveData } from '../store/save';
import type { IconName } from '../components/Icon';
import { RARITY_ORDER, rarityRank } from '../data/rarity';

export type TrophyEvent =
  | { type: 'pack'; cards: Card[] }
  | { type: 'battle'; mode: 'single' | 'team' | 'raid' | 'story'; result: 'win' | 'loss' | 'draw'; grade?: Rarity; upset?: boolean }
  | { type: 'other' };

export interface CollectionSummary {
  unique: number;
  byRarity: Record<Rarity, number>;
  byClass: Partial<Record<ObjClass, number>>;
  maxCopies: number;
  owned: (id: string) => boolean;
  ownedCards: Card[];
}

export interface TrophyCtx {
  save: SaveData;
  db: CardDb;
  col: CollectionSummary;
  event: TrophyEvent;
}

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'o5';

export interface TrophyDef {
  id: string;
  /** glifo de la insignia */
  icon: IconName;
  /** metal de la insignia según dificultad */
  tier: TrophyTier;
  /** rótulo corto bajo el glifo (p. ej. "100", "SSR") */
  label?: string;
  /** oculto: se muestra como "?????" hasta desbloquearlo */
  secret?: boolean;
  /** parámetros para el texto traducido; los trofeos con params comparten clave (trophy.team.*) */
  params?: Record<string, string>;
  check: (ctx: TrophyCtx) => boolean;
}

/** Clave de texto de un trofeo en src/i18n. */
export const trophyKey = (t: Pick<TrophyDef, 'id' | 'params'>) => (t.params ? t.id.replace(/_[^_]+$/, '') : t.id);

export function summarize(save: SaveData, db: CardDb): CollectionSummary {
  const byRarity = { C: 0, UC: 0, R: 0, SR: 0, SSR: 0, UR: 0, LR: 0 } as Record<Rarity, number>;
  const byClass: Partial<Record<ObjClass, number>> = {};
  let maxCopies = 0;
  const ownedCards: Card[] = [];
  for (const [id, owned] of Object.entries(save.collection)) {
    const c = db.byId.get(id);
    if (!c) continue;
    ownedCards.push(c);
    byRarity[c.rarity]++;
    byClass[c.cls] = (byClass[c.cls] ?? 0) + 1;
    maxCopies = Math.max(maxCopies, owned.n);
  }
  return { unique: ownedCards.length, byRarity, byClass, maxCopies, owned: (id) => id in save.collection, ownedCards };
}

const packCards = (e: TrophyEvent) => (e.type === 'pack' ? e.cards : []);
const countAtLeast = (cards: Card[], min: Rarity) => cards.filter((c) => rarityRank(c.rarity) >= rarityRank(min)).length;
const anyOwned = (ctx: TrophyCtx, pred: (c: Card) => boolean) => ctx.col.ownedCards.some(pred);
const ownedCode = (ctx: TrophyCtx, code: string) => anyOwned(ctx, (c) => c.code === code);

const TEAM_TIER: TrophyTier[] = ['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'o5'];
const teamTrophies: TrophyDef[] = RARITY_ORDER.map((r, i) => ({
  id: `team_${r}`,
  icon: 'shield',
  tier: TEAM_TIER[i],
  label: r,
  params: { r },
  check: (ctx) => (ctx.save.counters.teamWins[r] ?? 0) > 0,
}));

export const TROPHIES: TrophyDef[] = [
  // Tiradas
  { id: 'pulls_1', icon: 'pack', tier: 'bronze', label: '1', check: (c) => c.save.packsOpened >= 1 },
  { id: 'pulls_10', icon: 'pack', tier: 'bronze', label: '10', check: (c) => c.save.packsOpened >= 10 },
  { id: 'pulls_100', icon: 'pack', tier: 'silver', label: '100', check: (c) => c.save.packsOpened >= 100 },
  { id: 'pulls_1000', icon: 'pack', tier: 'gold', label: '1K', check: (c) => c.save.packsOpened >= 1000 },
  { id: 'pulls_10000', icon: 'pack', tier: 'o5', label: '10K', check: (c) => c.save.packsOpened >= 10000 },
  // Colección
  { id: 'uniq_50', icon: 'folder', tier: 'bronze', label: '50', check: (c) => c.col.unique >= 50 },
  { id: 'uniq_500', icon: 'folder', tier: 'silver', label: '500', check: (c) => c.col.unique >= 500 },
  { id: 'uniq_2500', icon: 'archive', tier: 'gold', label: '2.5K', check: (c) => c.col.unique >= 2500 },
  { id: 'uniq_all', icon: 'eye', tier: 'o5', label: 'TODO', check: (c) => c.col.unique >= c.db.all.length },
  { id: 'commons_1000', icon: 'broom', tier: 'silver', label: '1K', check: (c) => c.save.pulledByRarity.C >= 1000 },
  // Primeras rarezas
  { id: 'first_sr', icon: 'keycard', tier: 'bronze', label: 'SR', check: (c) => c.col.byRarity.SR > 0 },
  { id: 'first_ssr', icon: 'keycard', tier: 'silver', label: 'SSR', check: (c) => c.col.byRarity.SSR > 0 },
  { id: 'first_ur', icon: 'keycard', tier: 'gold', label: 'UR', check: (c) => c.col.byRarity.UR > 0 },
  { id: 'first_lr', icon: 'keycard', tier: 'o5', label: 'LR', check: (c) => c.col.byRarity.LR > 0 },
  { id: 'lr_5', icon: 'scale', tier: 'gold', label: '5 LR', check: (c) => c.col.byRarity.LR >= 5 },
  { id: 'lr_10', icon: 'vault', tier: 'o5', label: '10 LR', check: (c) => c.col.byRarity.LR >= 10 },
  // Patrones de paquete
  { id: 'pack_allc', icon: 'user', tier: 'bronze', label: 'D', check: (c) => { const p = packCards(c.event); return p.length > 0 && p.every((x) => x.rarity === 'C'); } },
  { id: 'pack_2ssr', icon: 'bolt', tier: 'silver', label: '×2', check: (c) => countAtLeast(packCards(c.event), 'SSR') >= 2 },
  { id: 'pack_2ur', icon: 'warning', tier: 'gold', label: 'XK', check: (c) => countAtLeast(packCards(c.event), 'UR') >= 2 },
  { id: 'pack_2lr', icon: 'crack', tier: 'o5', label: '×2', check: (c) => packCards(c.event).filter((x) => x.rarity === 'LR').length >= 2 },
  { id: 'pack_rainbow', icon: 'prism', tier: 'gold', check: (c) => new Set(packCards(c.event).map((x) => x.rarity)).size >= 5 },
  {
    id: 'pack_fullhouse', icon: 'house', tier: 'silver', label: '3+2',
    check: (c) => {
      const p = packCards(c.event);
      if (p.length !== 5) return false;
      const counts = Object.values(p.reduce<Record<string, number>>((m, x) => ((m[x.rarity] = (m[x.rarity] ?? 0) + 1), m), {})).sort();
      return counts.length === 2 && counts[0] === 2 && counts[1] === 3;
    },
  },
  { id: 'pack_5uc', icon: 'cards', tier: 'silver', label: '5 UC', check: (c) => { const p = packCards(c.event); return p.length === 5 && p.every((x) => x.rarity === 'UC'); } },
  // Duplicados
  { id: 'dupe_2', icon: 'copies', tier: 'bronze', label: '×2', check: (c) => c.col.maxCopies >= 2 },
  { id: 'dupe_3', icon: 'copies', tier: 'silver', label: '×3', check: (c) => c.col.maxCopies >= 3 },
  { id: 'dupe_5', icon: 'copies', tier: 'gold', label: '×5', check: (c) => c.col.maxCopies >= 5 },
  // Estadísticas
  { id: 'stat_glass', icon: 'sword', tier: 'silver', check: (c) => packCards(c.event).some((x) => x.atk >= 5000 && x.def <= 1500) },
  { id: 'stat_fortress', icon: 'shield', tier: 'silver', check: (c) => packCards(c.event).some((x) => x.def >= 5000 && x.atk <= 1800) },
  { id: 'stat_smash', icon: 'bolt', tier: 'gold', label: '10K', check: (c) => packCards(c.event).some((x) => x.atk > 10000) },
  { id: 'stat_wall', icon: 'wall', tier: 'gold', label: '10K', check: (c) => packCards(c.event).some((x) => x.def > 10000) },
  { id: 'stat_q100', icon: 'star', tier: 'o5', label: '100', check: (c) => packCards(c.event).some((x) => x.q >= 100) },
  { id: 'stat_q0', icon: 'leaf', tier: 'silver', label: '0', check: (c) => packCards(c.event).some((x) => x.q <= 0) },
  { id: 'stat_weak', icon: 'bug', tier: 'bronze', check: (c) => packCards(c.event).some((x) => x.atk < 1300) },
  // Clases
  { id: 'cls_safe', icon: 'lock', tier: 'silver', label: '100', check: (c) => (c.col.byClass.safe ?? 0) >= 100 },
  { id: 'cls_keter', icon: 'keter', tier: 'gold', label: '50', check: (c) => (c.col.byClass.keter ?? 0) >= 50 },
  { id: 'cls_thaumiel', icon: 'nodes', tier: 'gold', label: '10', check: (c) => (c.col.byClass.thaumiel ?? 0) >= 10 },
  { id: 'cls_apollyon', icon: 'crack', tier: 'gold', check: (c) => (c.col.byClass.apollyon ?? 0) > 0 },
  { id: 'cls_archon', icon: 'triangle', tier: 'gold', check: (c) => (c.col.byClass.archon ?? 0) > 0 },
  { id: 'cls_neutralized', icon: 'xcircle', tier: 'silver', label: '25', check: (c) => (c.col.byClass.neutralized ?? 0) >= 25 },
  {
    id: 'cls_all', icon: 'grid', tier: 'o5',
    check: (c) => (['safe', 'euclid', 'keter', 'thaumiel', 'apollyon', 'archon', 'esoteric', 'neutralized', 'explained'] as ObjClass[]).every((k) => (c.col.byClass[k] ?? 0) > 0),
  },
  // Secretos
  { id: 's_173', icon: 'statue', tier: 'o5', label: '173', secret: true, check: (c) => ownedCode(c, 'SCP-173') },
  { id: 's_682', icon: 'jaw', tier: 'o5', label: '682', secret: true, check: (c) => ownedCode(c, 'SCP-682') },
  { id: 's_096', icon: 'eyeOff', tier: 'o5', label: '096', secret: true, check: (c) => ownedCode(c, 'SCP-096') },
  { id: 's_999', icon: 'blob', tier: 'gold', label: '999', secret: true, check: (c) => ownedCode(c, 'SCP-999') },
  { id: 's_round', icon: 'target', tier: 'silver', label: '000', secret: true, check: (c) => packCards(c.event).some((x) => x.num !== null && x.num > 0 && x.num % 1000 === 0) },
  { id: 's_joke', icon: 'mask', tier: 'silver', label: '-J', secret: true, check: (c) => anyOwned(c, (x) => /-J$/i.test(x.code)) },
  { id: 's_ex', icon: 'magnifier', tier: 'silver', label: '-EX', secret: true, check: (c) => anyOwned(c, (x) => /-EX$/i.test(x.code)) },
  // Constancia
  { id: 'login_7', icon: 'calendar', tier: 'bronze', label: '7', check: (c) => c.save.login.stamps >= 7 },
  { id: 'login_30', icon: 'medal', tier: 'gold', label: '30', check: (c) => c.save.login.stamps >= 30 },
  { id: 'missions_all', icon: 'clipboard', tier: 'silver', check: (c) => c.save.counters.perfectDays >= 1 },
  { id: 'share_1', icon: 'antenna', tier: 'bronze', check: (c) => c.save.counters.shares >= 1 },
  { id: 'read_10', icon: 'book', tier: 'silver', label: '10', check: (c) => c.save.counters.reads >= 10 },
  // Combate
  { id: 'battle_1', icon: 'crosshair', tier: 'bronze', label: '1', check: (c) => c.save.counters.battlesWon >= 1 },
  { id: 'battle_10', icon: 'swords', tier: 'silver', label: '10', check: (c) => c.save.counters.battlesWon >= 10 },
  { id: 'battle_100', icon: 'helmet', tier: 'gold', label: '100', check: (c) => c.save.counters.battlesWon >= 100 },
  { id: 'battle_upset', icon: 'rock', tier: 'gold', check: (c) => c.save.counters.upsets >= 1 },
  ...teamTrophies,
  { id: 'raid_1', icon: 'siren', tier: 'silver', label: '1', check: (c) => c.save.counters.raidsDefeated >= 1 },
  { id: 'raid_3', icon: 'siren', tier: 'gold', label: '3', check: (c) => c.save.counters.raidsDefeated >= 3 },
  { id: 'raid_10', icon: 'siren', tier: 'o5', label: '10', check: (c) => c.save.counters.raidsDefeated >= 10 },
  { id: 'story_1', icon: 'compass', tier: 'bronze', label: '1', check: (c) => c.save.story.cleared >= 1 },
  { id: 'story_10', icon: 'compass', tier: 'bronze', label: '10', check: (c) => c.save.story.cleared >= 10 },
  { id: 'story_25', icon: 'flag', tier: 'silver', label: '25', check: (c) => c.save.story.cleared >= 25 },
  { id: 'story_50', icon: 'flag', tier: 'gold', label: '50', check: (c) => c.save.story.cleared >= 50 },
  { id: 'story_100', icon: 'flag', tier: 'o5', label: '100', check: (c) => c.save.story.cleared >= 100 },
];

export const trophyById = (id: string) => TROPHIES.find((t) => t.id === id);

/** Devuelve los trofeos recién desbloqueados. */
export function evaluateTrophies(save: SaveData, db: CardDb, event: TrophyEvent): TrophyDef[] {
  const pending = TROPHIES.filter((t) => !save.trophies[t.id]);
  if (pending.length === 0) return [];
  const ctx: TrophyCtx = { save, db, col: summarize(save, db), event };
  return pending.filter((t) => t.check(ctx));
}
