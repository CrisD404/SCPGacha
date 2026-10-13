import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import type { Card, PackType, Rarity } from '../data/types';
import { cards } from '../data/cards';
import { atLeast } from '../data/rarity';
import {
  isPityPack,
  MISSION_REWARD,
  normalizeStamina,
  O5_EVERY_STAMPS,
  openPack as rollPack,
  THAUMIEL_EVERY,
} from '../game/gacha';
import { MISSIONS, missionDef } from '../game/missions';
import { evaluateTrophies, TROPHIES, type TrophyEvent } from '../game/trophies';
import { cryptoRng } from '../game/rng';
import { levelUpCost, MAX_LEVEL, raidBossFor, raidBossHp, RAID_ATTEMPTS_PER_DAY, stageInfo } from '../game/battle';
import { dayKey, defaultSave, emptyProgress, migrateSave, type BattleRecord, type MissionId, type SaveData, type Settings } from './save';
import { notify, type NoticeInput } from './ui';
import { t, tk } from '../i18n';
import { trophyDesc, trophyName } from '../i18n/labels';

// ───────────────────────────── almacenamiento ─────────────────────────────

const memory = new Map<string, string>();
const storage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await idbGet<string>(name)) ?? null;
    } catch {
      try {
        return localStorage.getItem(name);
      } catch {
        return memory.get(name) ?? null;
      }
    }
  },
  setItem: async (name, value) => {
    try {
      await idbSet(name, value);
    } catch {
      try {
        localStorage.setItem(name, value);
      } catch {
        memory.set(name, value);
      }
    }
  },
  removeItem: async (name) => {
    try {
      await idbDel(name);
    } catch {
      /* noop */
    }
  },
};

// ───────────────────────────── helpers puros ─────────────────────────────

type Notes = NoticeInput[];

function applyDay(save: SaveData, now: number, notes: Notes): SaveData {
  const today = dayKey(now);
  let s = save;
  if (s.daily.date !== today) {
    s = { ...s, daily: { date: today, progress: emptyProgress(), done: [] } };
  }
  if (s.login.lastDate !== today) {
    const stamps = s.login.stamps + 1;
    const o5 = stamps % O5_EVERY_STAMPS === 0;
    s = {
      ...s,
      login: { lastDate: today, stamps },
      bonus: { thaumiel: s.bonus.thaumiel + (o5 ? 0 : 1), o5: s.bonus.o5 + (o5 ? 1 : 0) },
    };
    notes.push(
      o5
        ? { kind: 'reward', icon: 'stamp', tier: 'o5', label: `#${stamps}`, title: t('notice.o5Gift.title'), text: t('notice.o5Gift.text', { n: stamps }) }
        : { kind: 'reward', icon: 'stamp', label: `#${stamps}`, title: t('notice.stamp.title'), text: t('notice.stamp.text') },
    );
  }
  return s;
}

function addStamina(save: SaveData, amount: number, now: number): SaveData {
  const n = normalizeStamina(save, now);
  return { ...save, stamina: n.stamina + amount, staminaAt: n.staminaAt };
}

function progressMission(save: SaveData, id: MissionId, amount: number, now: number, notes: Notes): SaveData {
  if (save.daily.done.includes(id)) return save;
  const def = missionDef(id);
  const value = Math.min(def.target, save.daily.progress[id] + amount);
  let s: SaveData = { ...save, daily: { ...save.daily, progress: { ...save.daily.progress, [id]: value } } };
  if (value >= def.target) {
    const done = [...s.daily.done, id];
    s = addStamina({ ...s, daily: { ...s.daily, done } }, MISSION_REWARD, now);
    s = { ...s, counters: { ...s.counters, missionsCompleted: s.counters.missionsCompleted + 1 } };
    notes.push({ kind: 'mission', icon: 'clipboard', label: `+${MISSION_REWARD}`, title: tk(`mission.${def.id}`), text: t('notice.mission.text', { n: MISSION_REWARD }) });
    if (done.length === MISSIONS.length) {
      s = { ...s, counters: { ...s.counters, perfectDays: s.counters.perfectDays + 1 } };
    }
  }
  return s;
}

function applyTrophies(save: SaveData, event: TrophyEvent, now: number, notes: Notes): SaveData {
  const unlocked = evaluateTrophies(save, cards(), event);
  if (!unlocked.length) return save;
  const trophies = { ...save.trophies };
  for (const tr of unlocked) {
    trophies[tr.id] = now;
    const meta = `${Object.keys(trophies).length}/${TROPHIES.length}`;
    notes.push({ kind: 'trophy', icon: tr.icon, tier: tr.tier, label: tr.label, title: trophyName(tr), text: trophyDesc(tr), meta });
  }
  return { ...save, trophies };
}

/** Encola las notificaciones: el Notifier las muestra de a una. */
const flush = (notes: Notes) => notes.forEach(notify);

// ───────────────────────────── store ─────────────────────────────

export interface PackResult {
  type: PackType;
  cards: Card[];
  isNew: boolean[];
  copies: number[];
}

export interface BattleOutcome {
  mode: BattleRecord['mode'];
  result: BattleRecord['result'];
  cards: string[];
  grade?: Rarity;
  upset?: boolean;
  /** designación del rival (duelo) */
  rival?: string;
}

interface GameState {
  save: SaveData;
  hydrated: boolean;
  /** Paquetes entregados pero cuyas notificaciones se muestran al terminar la animación. */
  pendingNotes: Notes;
  tick: () => void;
  openPack: (type: 'standard' | 'thaumiel' | 'o5') => PackResult | null;
  releasePackNotes: () => void;
  toggleFav: (id: string) => void;
  markRead: () => void;
  markShared: () => void;
  recordBattle: (o: BattleOutcome) => void;
  ensureRaid: () => void;
  commitRaid: (damage: number, cardIds: string[]) => { defeated: boolean };
  setSquad: (ids: string[]) => void;
  completeStage: (n: number, won: boolean, cardIds: string[]) => number;
  levelUp: (id: string) => boolean;
  setSettings: (p: Partial<Settings>) => void;
  importSave: (data: SaveData) => void;
  resetAll: () => void;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** Aplica un cambio y emite notificaciones. */
      const commit = (fn: (s: SaveData, now: number, notes: Notes) => SaveData, defer = false) => {
        const now = Date.now();
        const notes: Notes = [];
        const next = fn(applyDay(get().save, now, notes), now, notes);
        if (defer) set({ save: next, pendingNotes: [...get().pendingNotes, ...notes] });
        else {
          set({ save: next });
          flush(notes);
        }
      };

      return {
        save: defaultSave(),
        hydrated: false,
        pendingNotes: [],

        tick: () => commit((s, now) => ({ ...s, ...normalizeStamina(s, now) })),

        openPack: (kind) => {
          let result: PackResult | null = null;
          commit((s0, now, notes) => {
            let s = s0;
            let type: PackType = kind;
            if (kind === 'standard') {
              const st = normalizeStamina(s, now);
              if (st.stamina < 1) return s;
              type = isPityPack(s.pityCounter) ? 'pity' : 'standard';
              s = { ...s, stamina: st.stamina - 1, staminaAt: st.staminaAt, pityCounter: type === 'pity' ? 0 : s.pityCounter + 1 };
            } else {
              if (s.bonus[kind] < 1) return s;
              s = { ...s, bonus: { ...s.bonus, [kind]: s.bonus[kind] - 1 } };
            }

            const pulled = rollPack(type, cryptoRng, cards());
            const collection = { ...s.collection };
            const pulledByRarity = { ...s.pulledByRarity };
            const isNew: boolean[] = [];
            const copies: number[] = [];
            for (const c of pulled) {
              const owned = collection[c.id];
              isNew.push(!owned);
              collection[c.id] = { n: (owned?.n ?? 0) + 1, first: owned?.first ?? now, last: now, fav: owned?.fav };
              copies.push(collection[c.id].n);
              pulledByRarity[c.rarity]++;
            }
            const packsOpened = s.packsOpened + 1;
            s = { ...s, collection, pulledByRarity, packsOpened, cardsPulled: s.cardsPulled + pulled.length };
            if (packsOpened % THAUMIEL_EVERY === 0) {
              s = { ...s, bonus: { ...s.bonus, thaumiel: s.bonus.thaumiel + 1 } };
              notes.push({ kind: 'reward', icon: 'pack', label: String(packsOpened), title: t('notice.milestone.title', { n: packsOpened }), text: t('notice.thaumielReward') });
            }
            s = progressMission(s, 'open5', 1, now, notes);
            if (pulled.some((c) => atLeast(c.rarity, 'SR'))) s = progressMission(s, 'srplus', 1, now, notes);
            s = applyTrophies(s, { type: 'pack', cards: pulled }, now, notes);
            result = { type, cards: pulled, isNew, copies };
            return s;
          }, true);
          return result;
        },

        releasePackNotes: () => {
          const notes = get().pendingNotes;
          set({ pendingNotes: [] });
          flush(notes);
        },

        toggleFav: (id) =>
          commit((s) => {
            const owned = s.collection[id];
            if (!owned) return s;
            return { ...s, collection: { ...s.collection, [id]: { ...owned, fav: !owned.fav } } };
          }),

        markRead: () =>
          commit((s, now, notes) => {
            const next = progressMission({ ...s, counters: { ...s.counters, reads: s.counters.reads + 1 } }, 'read', 1, now, notes);
            return applyTrophies(next, { type: 'other' }, now, notes);
          }),

        markShared: () =>
          commit((s, now, notes) => {
            const next = progressMission({ ...s, counters: { ...s.counters, shares: s.counters.shares + 1 } }, 'share', 1, now, notes);
            return applyTrophies(next, { type: 'other' }, now, notes);
          }),

        recordBattle: (o) =>
          commit((s0, now, notes) => {
            const won = o.result === 'win';
            const teamWins = { ...s0.counters.teamWins };
            if (won && o.mode === 'team' && o.grade) teamWins[o.grade] = (teamWins[o.grade] ?? 0) + 1;
            let s: SaveData = {
              ...s0,
              counters: {
                ...s0.counters,
                battlesPlayed: s0.counters.battlesPlayed + 1,
                battlesWon: s0.counters.battlesWon + (won ? 1 : 0),
                upsets: s0.counters.upsets + (won && o.upset ? 1 : 0),
                teamWins,
              },
              battleLog: [{ at: now, mode: o.mode, result: o.result, cards: o.cards, grade: o.grade, rival: o.rival }, ...s0.battleLog].slice(0, 30),
            };
            if (won) s = progressMission(s, 'win', 1, now, notes);
            return applyTrophies(s, { type: 'battle', mode: o.mode, result: o.result, grade: o.grade, upset: o.upset }, now, notes);
          }),

        ensureRaid: () =>
          commit((s, now) => {
            const today = dayKey(now);
            const r = s.raid;
            if (!r || (r.defeated && r.date !== today)) {
              const boss = raidBossFor(cards(), s.counters.raidsDefeated);
              const maxHp = raidBossHp(s.counters.raidsDefeated);
              return { ...s, raid: { date: today, bossId: boss.id, hp: maxHp, maxHp, attempts: 0, defeated: false, bestHit: 0 } };
            }
            if (r.date !== today) return { ...s, raid: { ...r, date: today, attempts: 0 } };
            return s;
          }),

        commitRaid: (damage, cardIds) => {
          let defeated = false;
          commit((s0, now, notes) => {
            const r = s0.raid;
            if (!r || r.defeated || r.attempts >= RAID_ATTEMPTS_PER_DAY) return s0;
            const hp = Math.max(0, r.hp - damage);
            defeated = hp === 0;
            const boss = cards().byId.get(r.bossId);
            let s: SaveData = { ...s0, raid: { ...r, hp, attempts: r.attempts + 1, defeated, bestHit: Math.max(r.bestHit, damage) } };
            if (defeated) {
              s = {
                ...s,
                bonus: { ...s.bonus, thaumiel: s.bonus.thaumiel + 1 },
                counters: { ...s.counters, raidsDefeated: s.counters.raidsDefeated + 1 },
              };
              notes.push({ kind: 'reward', icon: 'siren', tier: 'gold', title: t('notice.raidWin.title', { boss: boss?.code ?? '?' }), text: t('notice.thaumielReward') });
            }
            s = {
              ...s,
              counters: { ...s.counters, battlesPlayed: s.counters.battlesPlayed + 1, battlesWon: s.counters.battlesWon + (defeated ? 1 : 0) },
              battleLog: [
                { at: now, mode: 'raid' as const, result: defeated ? ('win' as const) : ('draw' as const), damage, rival: boss?.code, cards: cardIds },
                ...s.battleLog,
              ].slice(0, 30),
            };
            if (defeated) s = progressMission(s, 'win', 1, now, notes);
            return applyTrophies(s, { type: 'battle', mode: 'raid', result: defeated ? 'win' : 'draw' }, now, notes);
          });
          return { defeated };
        },

        setSquad: (ids) => commit((s) => ({ ...s, story: { ...s.story, squad: ids.slice(0, 5) } })),

        completeStage: (n, won, cardIds) => {
          let gained = 0;
          commit((s0, now, notes) => {
            const info = stageInfo(cards(), n);
            let s = s0;
            if (won) {
              const first = n === s.story.cleared + 1;
              gained = first ? info.xp : Math.floor(info.xp / 3);
              s = { ...s, story: { ...s.story, cleared: first ? n : s.story.cleared, xp: s.story.xp + gained } };
            }
            s = {
              ...s,
              counters: { ...s.counters, battlesPlayed: s.counters.battlesPlayed + 1, battlesWon: s.counters.battlesWon + (won ? 1 : 0) },
              battleLog: [{ at: now, mode: 'story' as const, result: won ? ('win' as const) : ('loss' as const), stage: n, cards: cardIds }, ...s.battleLog].slice(0, 30),
            };
            if (won) s = progressMission(s, 'win', 1, now, notes);
            return applyTrophies(s, { type: 'battle', mode: 'story', result: won ? 'win' : 'loss' }, now, notes);
          });
          return gained;
        },

        levelUp: (id) => {
          let ok = false;
          commit((s) => {
            const level = s.story.levels[id] ?? 1;
            const cost = levelUpCost(level);
            if (level >= MAX_LEVEL || s.story.xp < cost) return s;
            ok = true;
            return { ...s, story: { ...s.story, xp: s.story.xp - cost, levels: { ...s.story.levels, [id]: level + 1 } } };
          });
          return ok;
        },

        setSettings: (p) => set((st) => ({ save: { ...st.save, settings: { ...st.save.settings, ...p } } })),

        importSave: (data) => set({ save: migrateSave(data) }),

        resetAll: () => set({ save: defaultSave() }),
      };
    },
    {
      name: 'scp-gacha-save',
      storage: createJSONStorage(() => storage),
      partialize: (st) => ({ save: st.save }),
      merge: (persisted, current) => ({ ...current, save: migrateSave((persisted as { save?: unknown } | undefined)?.save) }),
      onRehydrateStorage: () => () => {
        useGame.setState({ hydrated: true });
      },
    },
  ),
);

export const useSave = <T,>(selector: (s: SaveData) => T) => useGame((st) => selector(st.save));

