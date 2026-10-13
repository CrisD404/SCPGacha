import type { Card, ObjClass, Rarity } from './types';
import { RARITY_ORDER } from './rarity';
import { summarize } from './summary';
import { getLang, type Lang } from '../i18n/lang';
import { t } from '../i18n';

interface Payload {
  version: number;
  generatedAt: string;
  source: string;
  columns: (keyof Card)[];
  rows: unknown[][];
}

export interface CardDb {
  all: Card[];
  byId: Map<string, Card>;
  byRarity: Record<Rarity, Card[]>;
  byClass: Partial<Record<ObjClass, Card[]>>;
  generatedAt: string;
  source: string;
}

let db: CardDb | null = null;

export function buildDb(payload: Payload): CardDb {
  const all = payload.rows.map((row) => {
    const card = {} as Record<string, unknown>;
    payload.columns.forEach((col, i) => (card[col] = row[i]));
    return card as unknown as Card;
  });
  const byRarity = Object.fromEntries(RARITY_ORDER.map((r) => [r, [] as Card[]])) as Record<Rarity, Card[]>;
  const byClass: Partial<Record<ObjClass, Card[]>> = {};
  for (const c of all) {
    byRarity[c.rarity].push(c);
    (byClass[c.cls] ??= []).push(c);
  }
  return { all, byId: new Map(all.map((c) => [c.id, c])), byRarity, byClass, generatedAt: payload.generatedAt, source: payload.source };
}

export async function loadCards(): Promise<CardDb> {
  if (db) return db;
  const res = await fetch(`${import.meta.env.BASE_URL}data/cards.json`);
  if (!res.ok) throw new Error(t('boot.loadError', { status: String(res.status) }));
  db = buildDb((await res.json()) as Payload);
  return db;
}

/** Acceso síncrono una vez cargado (la app no se monta antes). */
export function cards(): CardDb {
  if (!db) throw new Error('Card database not loaded');
  return db;
}

export function setCardDbForTests(value: CardDb) {
  db = value;
}

export const wikiUrl = (card: Pick<Card, 'id'>) => `https://scp-wiki.wikidot.com/${card.id}`;

// ───────────────────────────── traducciones de cartas ─────────────────────────────

interface CardTranslations {
  lang: string;
  method: string;
  names: Record<string, string>;
  descs: Record<string, string>;
}

const translations: Partial<Record<Lang, CardTranslations>> = {};
const pending: Partial<Record<Lang, Promise<boolean>>> = {};

/** Carga (una vez) las traducciones de nombres y descripciones; el inglés es el original. */
export function loadCardTranslations(lang: Lang): Promise<boolean> {
  if (lang === 'en' || translations[lang]) return Promise.resolve(true);
  pending[lang] ??= fetch(`${import.meta.env.BASE_URL}data/cards.${lang}.json`)
    .then((r) => (r.ok ? (r.json() as Promise<CardTranslations>) : null))
    .then((data) => {
      if (data) translations[lang] = data;
      return !!data;
    })
    .catch(() => false);
  return pending[lang]!;
}

export const cardTranslationsLoaded = (lang: Lang) => lang === 'en' || !!translations[lang];

const tr = () => translations[getLang()];

/** Apodo en el idioma actual (o el original en inglés si no hay traducción). */
export const cardName = (card: Pick<Card, 'id' | 'name'>) => tr()?.names[card.id] || card.name;

/** Descripción en el idioma actual (o la original). */
export const cardDesc = (card: Pick<Card, 'id' | 'desc'>) => tr()?.descs[card.id] || card.desc;

/** Caracteres que entran en el recuadro de descripción de la carta (6 líneas de fuente mono). */
export const FACE_DESC_CHARS = 200;
const summaries = new Map<string, string>();

/** Resumen coherente de la descripción para la cara de la carta (oraciones completas; ver summary.ts). */
export function cardSummary(card: Pick<Card, 'id' | 'desc'>, max = FACE_DESC_CHARS): string {
  const key = `${tr() ? getLang() : 'en'}|${max}|${card.id}`;
  let out = summaries.get(key);
  if (out === undefined) {
    out = summarize(cardDesc(card), max);
    summaries.set(key, out);
  }
  return out;
}

/** true si el texto mostrado es una traducción automática. */
export const isTranslated = (card: Pick<Card, 'id'>) => !!tr()?.descs[card.id];

export const displayName = (card: Pick<Card, 'id' | 'name' | 'code'>) => cardName(card) || card.code;
