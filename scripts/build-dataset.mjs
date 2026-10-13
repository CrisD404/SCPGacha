#!/usr/bin/env node
/**
 * Construye public/data/cards.json a partir del dataset público de la wiki SCP
 * publicado por scp-data.tedivm.com (contenido CC BY-SA 3.0).
 *
 * Uso:
 *   node scripts/build-dataset.mjs [--cache <dir>] [--offline]
 *
 * --cache    carpeta donde se guardan/leen los JSON descargados (por defecto .cache/scp-data)
 * --offline  no descarga nada, sólo usa lo que haya en la caché
 *
 * El criterio de rareza está documentado en el README y en el Manual del Agente (en el juego).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'https://scp-data.tedivm.com/data/scp';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const CACHE = path.resolve(argValue('--cache') ?? path.join(ROOT, '.cache', 'scp-data'));
const OFFLINE = args.includes('--offline');
const OUT = path.join(ROOT, 'public', 'data', 'cards.json');

// ───────────────────────────── descarga / caché ─────────────────────────────

async function getJson(relPath, fileName) {
  const file = path.join(CACHE, fileName);
  if (!fs.existsSync(file)) {
    if (OFFLINE) throw new Error(`Falta ${file} y se pidió --offline`);
    fs.mkdirSync(CACHE, { recursive: true });
    const url = `${BASE_URL}/${relPath}`;
    process.stdout.write(`↓ ${url}\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ───────────────────────────── utilidades de texto ─────────────────────────────

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function stripHtml(html) {
  return decodeEntities(
    html
      .replace(/<sup class="footnoteref">[\s\S]*?<\/sup>/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .trim();
}

/** Abreviaturas que terminan en punto pero no cierran la oración. */
const ABBREV = /(?:^|\s)(?:Dr|Mr|Mrs|Ms|Mx|St|Mt|Jr|Sr|Lt|Col|Gen|Sgt|Capt|Prof|Rev|No|vs|etc|approx|ca|e\.g|i\.e|U\.S|U\.K|Inc|Ltd|Co|Fig|Vol|[A-Z])\.$/;

/** Recorta en un límite de oración (o de línea, en las listas) cercano a `max` caracteres. */
function clip(text, max = 240) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  let best = -1;
  for (const m of cut.matchAll(/[.!?](?=\s)|\n/g)) {
    if (m[0] === '\n') best = m.index - 1;
    else if (!ABBREV.test(cut.slice(0, m.index + 1))) best = m.index;
  }
  if (best > max * 0.45) return cut.slice(0, best + 1).trimEnd();
  const lastSpace = cut.lastIndexOf(' ');
  return cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[,;:\s]+$/, '') + '…';
}

/** Hash FNV-1a de 32 bits → número estable por carta. */
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const unit = (str) => hash32(str) / 0xffffffff;

// ───────────────────────────── clase de objeto ─────────────────────────────

const PRIMARY_CLASSES = ['safe', 'euclid', 'keter', 'thaumiel', 'apollyon', 'archon', 'neutralized', 'explained', 'pending', 'decommissioned'];
const CLASS_ALIASES = { neutralised: 'neutralized', 'n/a': '', none: '', unknown: '', esoteric: '' };
/** Palabras que aparecen tras "Object Class:" pero no son una clase. */
const NOT_A_CLASS = new Set(['see', 'standard', 'null', 'multiple', 'special', 'unnecessary', 'unassigned', 'the', 'not', 'varies', 'variable', 'various', 'redacted', 'data', 'expunged', 'classified', 'error', 'undefined', 'unclassified']);

function normalizeClassWord(raw) {
  if (!raw) return '';
  const w = decodeEntities(raw).toLowerCase().replace(/[^a-zÀ-ɏ/ -]/g, '').trim().split(/[\s/]+/)[0] ?? '';
  if (w in CLASS_ALIASES) return CLASS_ALIASES[w];
  if (w.length < 3 || w.length > 18 || NOT_A_CLASS.has(w)) return '';
  return w;
}

function parseClassFromHtml(html) {
  // 1) Barra ACS (anom-bar): Containment / Secondary Class
  let m = html.match(/class="contain-class">[\s\S]{0,200}?class="class-text">([^<]+)</);
  if (m) {
    let main = normalizeClassWord(m[1]);
    if (!main || main === 'esoteric') {
      const s = html.match(/class="second-class">[\s\S]{0,200}?class="class-text">([^<]+)</);
      if (s) main = normalizeClassWord(s[1]);
    }
    if (main) return main;
  }
  // 2) Variante acs-contain
  m = html.match(/Containment Class:<\/strong><\/span>\s*<span>([^<]+)</);
  if (m) {
    let main = normalizeClassWord(m[1]);
    if (!main) {
      const s = html.match(/Secondary Class:<\/strong><\/span>\s*<span>([^<]+)</);
      if (s) main = normalizeClassWord(s[1]);
    }
    if (main) return main;
  }
  // 3) Formato clásico
  m = html.match(/Object Class:?\s*<\/strong>:?\s*(?:<[^>]+>\s*)*([^<\n]{2,40})/i);
  if (m) return normalizeClassWord(m[1]);
  return '';
}

function resolveClass(tags, html) {
  const parsed = html ? parseClassFromHtml(html) : '';
  const tagClass = PRIMARY_CLASSES.find((c) => tags.includes(c)) ?? '';
  // Las etiquetas de estado final (neutralizado, explicado, desmantelado) tienen prioridad.
  for (const finalState of ['decommissioned', 'explained', 'neutralized']) {
    if (tags.includes(finalState)) return { cls: finalState, label: finalState };
  }
  if (parsed && PRIMARY_CLASSES.includes(parsed)) return { cls: parsed, label: parsed };
  if (tagClass) return { cls: tagClass, label: tagClass };
  if (parsed && /^[a-zÀ-ɏ-]+$/.test(parsed)) return { cls: 'esoteric', label: parsed };
  if (tags.includes('esoteric-class')) return { cls: 'esoteric', label: 'esoteric' };
  return { cls: 'unknown', label: 'unknown' };
}

// ───────────────────────────── descripción ─────────────────────────────

/**
 * Párrafos que son metadatos del artículo y no la descripción del objeto: nota de atribución de la wiki
 * ("… from the SCP Wiki. Source: … Licensed under CC BY-SA."), cajas de autor, créditos y avisos de contenido.
 */
const isAttribution = (p) =>
  /\bAuthors?\s*:|Crit Credits?\s*:|Image Credit|Content Warnings?\s*:|not optimi[sz]ed for mobile|^Written by|This article was originally written by|Released under a CC BY-SA|from the SCP Wiki\.|Licensed under CC BY-SA|^Source:\s*https?:|Thanks to my critters|Generated with the StarCharter|License Box component|Licensing Guide|click Continue to view|wish to read such content|Author'?s? [Pp]age|\bby:\s|\d+(?:st|nd|rd|th) article for|Collaboration Contest|Make sure you check out|Stay Tuned for|This article shares continuity|do not need to read/i.test(p);

/**
 * Largo máximo de la descripción guardada. La vista expandida de la carta la muestra completa;
 * la cara de la carta muestra un resumen coherente calculado en el cliente (src/data/summary.ts).
 */
const DESC_MAX = 760;
/** Párrafo que abre otra sección del artículo ("Addendum:", "Note:", "Recovery:"…). */
const SECTION_START = /^\s*<strong>[^<]{1,48}<\/strong>/i;
const HEADER_FIELD = /^(Item|Object Class|Special Containment|Containment|Rating|Clearance|Disruption|Risk)/i;

function parseDescription(html) {
  if (!html) return '';
  const paras = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => ({ raw: m[1], start: m.index, end: m.index + m[0].length }));
  let at = paras.findIndex((p) => /<strong>\s*Description\s*:?\s*<\/strong>/i.test(p.raw));
  let first = at >= 0 ? stripHtml(paras[at].raw.replace(/^[\s\S]*?<strong>\s*Description\s*:?\s*<\/strong>/i, '')).replace(/^[:\s]+/, '') : '';
  if (first.length < 40 || isAttribution(first)) {
    // Formatos no estándar: primer párrafo largo que no sea cabecera de ficha ni la nota de atribución,
    // y mejor si no es un procedimiento de contención ("… is to be kept …").
    const usable = (p) => {
      const text = stripHtml(p.raw);
      return text.length > 80 && !isAttribution(text) && !HEADER_FIELD.test(text);
    };
    const procedure = (p) => /\b(?:is|are) to be\b|\bmust be\b|\bshall be\b|\bis to\b|\bare to\b/i.test(stripHtml(p.raw).split(/(?<=[.!?])\s/)[0]);
    let alt = paras.findIndex((p) => usable(p) && !procedure(p));
    if (alt < 0) alt = paras.findIndex(usable);
    if (alt >= 0) {
      at = alt;
      first = stripHtml(paras[alt].raw);
    }
  }
  // sin descripción utilizable, la carta muestra "[DATOS ELIMINADOS]"
  if (!first || isAttribution(first)) return '';
  // sigue con los bloques consecutivos de la misma sección: párrafos y listas (una lista va como líneas "• …").
  // Se corta ante tablas, citas, imágenes, colapsables o un nuevo apartado.
  const parts = [first];
  let len = first.length;
  const BLOCK = /\s*(?:<p>([\s\S]*?)<\/p>|<(ul|ol)>([\s\S]*?)<\/\2>)/y;
  BLOCK.lastIndex = at >= 0 ? paras[at].end : html.length;
  for (let m; len < DESC_MAX && (m = BLOCK.exec(html)); ) {
    let text;
    if (m[1] !== undefined) {
      if (SECTION_START.test(m[1])) break;
      text = stripHtml(m[1]);
      if (!text || isAttribution(text) || HEADER_FIELD.test(text)) break;
    } else {
      const items = [...m[3].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => stripHtml(li[1])).filter(Boolean);
      if (!items.length) break;
      text = items.map((it) => `• ${it}`).join('\n');
    }
    parts.push(text);
    len += text.length + 2;
  }
  // las viñetas van pegadas a su introducción y entre sí (un solo salto de línea)
  let text = clip(parts.join('\n\n').replace(/\n\n(?=• )/g, '\n'), DESC_MAX);
  // una frase final que anuncia algo que no se capturó ("To clarify:", "… the following items:") queda colgando
  const dangling = /^([\s\S]*[.!?…"”)])\s+[^.!?…\n]*:\s*$/.exec(text);
  if (dangling && dangling[1].length >= 40) text = dangling[1];
  return text;
}

// ───────────────────────────── apodos (hubs de series) ─────────────────────────────

function parseNicknames(hubs) {
  const names = new Map();
  const hubKeys = Object.keys(hubs).filter((k) => /^scp-series(-\d+)?$|^joke-scps$|^scp-ex$|^archived-scps$|^scp-international$/.test(k));
  for (const k of hubKeys) {
    const html = hubs[k].raw_content ?? '';
    for (const m of html.matchAll(/<li>\s*<a href="\/([^"]+)"[^>]*>[^<]*<\/a>\s*[-–—]\s*([\s\S]*?)<\/li>/g)) {
      const slug = m[1].toLowerCase();
      let nick = stripHtml(m[2]).replace(/\s+-\s+The Original$/i, '');
      if (!nick || nick.length > 90 || /^\[ACCESS DENIED\]$/i.test(nick)) continue;
      if (!names.has(slug)) names.set(slug, nick);
    }
  }
  return names;
}

// ───────────────────────────── estadística ─────────────────────────────

/** Percentil (0..1) con empates promediados. */
function percentiles(values) {
  const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  const n = values.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const p = n === 1 ? 1 : (i + j) / 2 / (n - 1);
    for (let k = i; k <= j; k++) out[idx[k][1]] = p;
    i = j + 1;
  }
  return out;
}

// ───────────────────────────── criterio de juego ─────────────────────────────

/** Peso de "notoriedad" por clase: clases más raras/dramáticas suman más. */
const CLASS_NOTORIETY = {
  safe: 0.25, euclid: 0.45, keter: 0.75, thaumiel: 0.9, apollyon: 1, archon: 0.95, esoteric: 0.7,
  neutralized: 0.35, explained: 0.15, pending: 0.35, decommissioned: 0.2, unknown: 0.3,
};
/** Peligrosidad (componente de ATK). */
const CLASS_DANGER = {
  safe: 0.18, euclid: 0.45, keter: 0.82, thaumiel: 0.62, apollyon: 1, archon: 0.88, esoteric: 0.66,
  neutralized: 0.2, explained: 0.08, pending: 0.5, decommissioned: 0.35, unknown: 0.4,
};
const DANGER_TAGS = new Set([
  'hostile', 'predatory', 'k-class-scenario', 'reality-bending', 'weapon', 'murder-monster', 'contagion', 'cognitohazard',
  'memetic', 'infohazard', 'antimemetic', 'biohazard', 'radioactive', 'uncontained', 'parasitic', 'carnivorous',
  'teleportation', 'telekinetic', 'fire', 'self-replicating', 'airborne', 'body-horror',
]);
const TOUGH_TAGS = new Set([
  'indestructible', 'self-repairing', 'adaptive', 'intangible', 'extradimensional', 'regenerative', 'immortal',
  'structure', 'building', 'location', 'city', 'geological', 'subterranean', 'invulnerable', 'shielding', 'spatial',
]);

/**
 * Rarezas por percentil del Índice de Notoriedad.
 * Los nombres siguen los Niveles de Autorización de la Fundación.
 */
const TIERS = [
  { id: 'LR', min: 99.5, mult: 2.35 },
  { id: 'UR', min: 98.0, mult: 2.0 },
  { id: 'SSR', min: 94.0, mult: 1.7 },
  { id: 'SR', min: 84.0, mult: 1.45 },
  { id: 'R', min: 64.0, mult: 1.25 },
  { id: 'UC', min: 34.0, mult: 1.12 },
  { id: 'C', min: -1, mult: 1.0 },
];

/** Leyendas del canon: siempre O5 (LR) aunque el cálculo las deje un poco por debajo. */
const CANON_LEGENDS = new Set(['scp-173', 'scp-682', 'scp-096', 'scp-049', 'scp-106', 'scp-999', 'scp-914', 'scp-055', 'scp-087', 'scp-3008', 'scp-2000', 'scp-3000', 'scp-001', 'scp-076', 'scp-035', 'scp-343', 'scp-5000', 'scp-6000', 'scp-7000', 'scp-8000', 'scp-4000', 'scp-2317', 'scp-1000', 'scp-3001']);

/** Apodos que los hubs no exponen con el formato estándar. */
const NAME_OVERRIDES = { taboo: 'Taboo', 'dyfscp-001': 'Project Backaway' };

const HIDDEN_TAGS = /^_|^\d+$|^(scp|co-authored|featured|reviewers-spotlight|rewrite|illustrated|meta|_cc|_cc4|_licensebox|_listpages|esoteric-class|safe|euclid|keter|thaumiel|neutralized|explained|pending|decommissioned)$/;

// ───────────────────────────── main ─────────────────────────────

async function main() {
  const index = await getJson('items/index.json', 'index.json');
  const contentIndex = await getJson('items/content_index.json', 'content_index.json');
  const hubs = await getJson('hubs/index.json', 'hubs.json');
  const nicknames = parseNicknames(hubs);

  /** @type {Map<string, {html: string}>} */
  const extracted = new Map();
  for (const file of new Set(Object.values(contentIndex))) {
    const content = await getJson(`items/${file}`, file);
    for (const [key, v] of Object.entries(content)) {
      const html = v.raw_content ?? '';
      const tags = v.tags ?? [];
      extracted.set(key, {
        cls: resolveClass(tags, html),
        desc: parseDescription(html),
        words: stripHtml(html).split(' ').length,
      });
    }
    process.stdout.write(`· ${file}: ${Object.keys(content).length} expedientes\n`);
  }

  const items = Object.entries(index).map(([key, v]) => {
    const ex = extracted.get(key) ?? { cls: resolveClass(v.tags, ''), desc: '', words: 0 };
    return { key, ...v, ex };
  });

  // Referencias entrantes: cuántos expedientes enlazan a éste (canonicidad).
  const bySlug = new Map(items.map((it) => [it.link.toLowerCase(), it]));
  const inbound = new Map();
  for (const it of items) {
    for (const ref of new Set((it.references ?? []).map((r) => r.toLowerCase()))) {
      if (ref !== it.link.toLowerCase() && bySlug.has(ref)) inbound.set(ref, (inbound.get(ref) ?? 0) + 1);
    }
  }

  const seriesGroup = (s) => (/^series-\d+$/.test(s) ? s : 'other');
  const gPct = percentiles(items.map((it) => it.rating));
  const refPct = percentiles(items.map((it) => inbound.get(it.link.toLowerCase()) ?? 0));
  const wordPct = percentiles(items.map((it) => it.ex.words));
  const spPct = new Array(items.length);
  const groups = new Map();
  items.forEach((it, i) => {
    const g = seriesGroup(it.series);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(i);
  });
  for (const idxs of groups.values()) {
    const p = percentiles(idxs.map((i) => items[i].rating));
    idxs.forEach((i, k) => (spPct[i] = p[k]));
  }

  const scores = items.map((it, i) => {
    const featured = it.tags.includes('featured') || it.tags.includes('reviewers-spotlight') ? 1 : 0;
    return 0.45 * gPct[i] + 0.25 * spPct[i] + 0.15 * refPct[i] + 0.1 * CLASS_NOTORIETY[it.ex.cls.cls] + 0.05 * featured;
  });
  const qPct = percentiles(scores);

  const cards = items.map((it, i) => {
    const slug = it.link.toLowerCase();
    const q = Math.round(qPct[i] * 1000) / 10;
    let tier = TIERS.find((t) => q >= t.min);
    if (CANON_LEGENDS.has(slug)) tier = TIERS[0];

    const tags = it.tags.filter((t) => !HIDDEN_TAGS.test(t));
    const dangerTags = Math.min(1, tags.filter((t) => DANGER_TAGS.has(t)).length / 3);
    const toughTags = Math.min(1, tags.filter((t) => TOUGH_TAGS.has(t)).length / 2);
    const threat = 0.45 * CLASS_DANGER[it.ex.cls.cls] + 0.3 * dangerTags + 0.1 * gPct[i] + 0.15 * unit(slug + ':atk');
    const resilience = 0.55 * wordPct[i] + 0.25 * toughTags + 0.2 * unit(slug + ':def');
    const atk = Math.min(15000, Math.round((900 + 5100 * threat) * tier.mult));
    const def = Math.min(15000, Math.round((700 + 5300 * resilience) * tier.mult));

    return {
      id: slug,
      code: it.title,
      num: it.scp_number ?? null,
      name: NAME_OVERRIDES[slug] ?? nicknames.get(slug) ?? '',
      cls: it.ex.cls.cls,
      clsLabel: it.ex.cls.label === it.ex.cls.cls ? '' : it.ex.cls.label,
      rarity: tier.id,
      q,
      atk,
      def,
      rating: it.rating,
      series: it.series,
      author: it.creator ?? '',
      year: it.created_at ? Number(it.created_at.slice(0, 4)) : null,
      tags: tags.slice(0, 6),
      desc: it.ex.desc,
    };
  });

  cards.sort((a, b) => (a.num ?? 1e9) - (b.num ?? 1e9) || a.id.localeCompare(b.id));

  // Formato compacto: columnas + filas, ahorra ~40 % frente a objetos.
  const columns = Object.keys(cards[0]);
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'scp-data.tedivm.com · SCP Foundation Wiki (CC BY-SA 3.0)',
    columns,
    rows: cards.map((c) => columns.map((k) => c[k])),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));

  // Resumen
  const byTier = Object.fromEntries(TIERS.map((t) => [t.id, cards.filter((c) => c.rarity === t.id).length]));
  const byClass = {};
  for (const c of cards) byClass[c.cls] = (byClass[c.cls] ?? 0) + 1;
  const noDesc = cards.filter((c) => !c.desc).length;
  const noName = cards.filter((c) => !c.name).length;
  console.log(`\n✔ ${cards.length} cartas → ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`);
  console.log('Rarezas:', byTier);
  console.log('Clases:', byClass);
  console.log(`Sin descripción: ${noDesc} · Sin apodo: ${noName}`);
  console.log('LR:', cards.filter((c) => c.rarity === 'LR').map((c) => `${c.code} ${c.name}`).join(' | '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
