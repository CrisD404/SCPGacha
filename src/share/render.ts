import type { Card, Rarity } from '../data/types';
import { RARITIES, RARITY_ORDER, maxRarity, rarityRank } from '../data/rarity';
import { CLASSES } from '../data/classes';
import { cardName, cardSummary } from '../data/cards';
import { fmt, fmtDate, t } from '../i18n';
import { classLabel, packName } from '../i18n/labels';
import { hash32, mulberry32 } from '../game/rng';
import type { ShareScene, ShareStamp, ShareTheme } from './types';

/**
 * Render de la imagen para redes en <canvas>. Todo depende de `t` (0–1) para que
 * PNG, GIF y video salgan del mismo dibujo y el bucle animado sea continuo.
 */

const TAU = Math.PI * 2;
const BEBAS = '"Bebas Neue", Impact, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const INTER = '"Inter Variable", system-ui, sans-serif';
const PRISM = ['#ff8cf0', '#ffc845', '#5fe0ff', '#43d39e', '#b57bff', '#ff8cf0'];

type Ctx = CanvasRenderingContext2D;

interface Palette {
  ink: string;
  dim: string;
  accent: string;
  dark: boolean;
}

export interface Env {
  arts: Map<string, HTMLImageElement>;
}

// ───────────────────────────── utilidades ─────────────────────────────

const font = (px: number, family: string, weight: number | string = 400) => `${weight} ${Math.round(px * 10) / 10}px ${family}`;

function spacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`;
}

function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width <= maxW || !line) {
      line = test;
      continue;
    }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) {
      line = '';
      break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.replace(/\s*\S+$/, '');
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

/** Tamaño de fuente que hace entrar `text` en `maxW`. */
function fit(ctx: Ctx, text: string, maxW: number, maxPx: number, minPx: number, family: string, weight: number | string = 400): number {
  let px = maxPx;
  ctx.font = font(px, family, weight);
  while (px > minPx && ctx.measureText(text).width > maxW) {
    px -= 2;
    ctx.font = font(px, family, weight);
  }
  return px;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Emblema de la Fundación en coordenadas -100…100. */
function emblemPath(): Path2D {
  const p = new Path2D();
  const arrow = new Path2D('M-11 -100 h22 v35 h15 l-26 32 l-26 -32 h15 z');
  for (const deg of [0, 120, 240]) {
    const m = new DOMMatrix().rotate(deg);
    p.addPath(arrow, m);
  }
  return p;
}
const EMBLEM = typeof Path2D !== 'undefined' ? emblemPath() : null;

function drawEmblem(ctx: Ctx, cx: number, cy: number, size: number, color: string, core = '#ff3b4e', rot = 0) {
  if (!EMBLEM) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(size / 200, size / 200);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(0, 0, 84, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, TAU);
  ctx.stroke();
  ctx.fill(EMBLEM);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function star(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// ───────────────────────────── fondos ─────────────────────────────

function palette(theme: ShareTheme, accent: string): Palette {
  switch (theme) {
    case 'alert':
      return { ink: '#fff2f2', dim: '#ffb3bb', accent: '#ff4d5e', dark: true };
    case 'thaumiel':
      return { ink: '#ffffff', dim: '#ddd2f7', accent: '#ff8cf0', dark: true };
    case 'dossier':
      return { ink: '#1d1c19', dim: '#5c5547', accent: '#a3121f', dark: false };
    default:
      return { ink: '#ece7da', dim: '#9ba1ab', accent, dark: true };
  }
}

function background(ctx: Ctx, W: number, H: number, theme: ShareTheme, accent: string, tt: number, s: number) {
  if (theme === 'archive') {
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.85);
    g.addColorStop(0, `${accent}40`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = Math.max(1, s);
    const step = 40 * s;
    ctx.beginPath();
    for (let x = 0; x <= W; x += step) ctx.moveTo(x, 0), ctx.lineTo(x, H);
    for (let y = 0; y <= H; y += step) ctx.moveTo(0, y), ctx.lineTo(W, y);
    ctx.stroke();
    ctx.globalAlpha = 0.05;
    drawEmblem(ctx, W / 2, H * 0.52, Math.min(W, H) * 0.95, '#ffffff', '#ffffff', (tt * TAU) / 3);
    ctx.globalAlpha = 1;
    const by = ((tt * 1.0) % 1) * (H + 240 * s) - 120 * s;
    g = ctx.createLinearGradient(0, by - 90 * s, 0, by + 90 * s);
    g.addColorStop(0, 'transparent');
    g.addColorStop(0.5, 'rgba(255,255,255,0.045)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, by - 90 * s, W, 180 * s);
  } else if (theme === 'alert') {
    ctx.fillStyle = '#140205';
    ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(150,10,25,0.55)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const c = ctx.createConicGradient(tt * TAU, W / 2, H * 0.5);
    c.addColorStop(0, 'rgba(255,40,60,0.32)');
    c.addColorStop(0.12, 'rgba(255,40,60,0)');
    c.addColorStop(0.5, 'rgba(255,40,60,0)');
    c.addColorStop(0.62, 'rgba(255,40,60,0.32)');
    c.addColorStop(0.74, 'rgba(255,40,60,0)');
    c.addColorStop(1, 'rgba(255,40,60,0.32)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const band = 26 * s;
    const sw = 28 * s;
    const off = tt * sw * 2;
    for (const y of [0, H - band]) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, y, W, band);
      ctx.clip();
      ctx.fillStyle = '#111';
      ctx.fillRect(0, y, W, band);
      ctx.fillStyle = '#f5c518';
      for (let x = -band * 2 + off - sw * 2; x < W + band; x += sw * 2) {
        ctx.beginPath();
        ctx.moveTo(x, y + band);
        ctx.lineTo(x + band, y);
        ctx.lineTo(x + band + sw, y);
        ctx.lineTo(x + sw, y + band);
        ctx.fill();
      }
      ctx.restore();
    }
    g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (theme === 'thaumiel') {
    ctx.fillStyle = '#0c0716';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    ['#ff8cf0', '#ffc845', '#5fe0ff', '#b57bff'].forEach((col, k) => {
      const a = TAU * (tt + k / 4);
      const cx = W * (0.5 + 0.32 * Math.cos(a));
      const cy = H * (0.5 + 0.3 * Math.sin(a * 1));
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
      g.addColorStop(0, `${col}55`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });
    ctx.globalCompositeOperation = 'source-over';
    const rng = mulberry32(7);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 46; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const ph = rng();
      const r = (2 + rng() * 7) * s;
      ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(TAU * (tt + ph)));
      star(ctx, x, y, r);
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, 'rgba(5,2,12,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    // expediente: carpeta de papel manila
    ctx.fillStyle = '#d6c49a';
    ctx.fillRect(0, 0, W, H);
    const rng = mulberry32(42);
    ctx.lineWidth = Math.max(1, s);
    for (let i = 0; i < 900; i++) {
      const x = rng() * W;
      const y = rng() * H;
      const len = (6 + rng() * 26) * s;
      const a = rng() * Math.PI;
      ctx.strokeStyle = `rgba(${90 + rng() * 40},${60 + rng() * 30},${20},${0.05 + rng() * 0.07})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    let g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, 'rgba(70,45,10,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // aro de café
    ctx.strokeStyle = 'rgba(110,70,25,0.12)';
    ctx.lineWidth = 10 * s;
    ctx.beginPath();
    ctx.arc(W * 0.86, H * 0.9, 90 * s, 0.3, TAU - 0.6);
    ctx.stroke();
    // línea de escaneo de fotocopiadora
    const by = (tt % 1) * H;
    g = ctx.createLinearGradient(0, by - 60 * s, 0, by + 60 * s);
    g.addColorStop(0, 'transparent');
    g.addColorStop(0.5, 'rgba(255,255,240,0.18)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(0, by - 60 * s, W, 120 * s);
  }
}

// ───────────────────────────── carta ─────────────────────────────

function borderPaint(ctx: Ctx, r: Rarity, x: number, y: number, w: number, h: number, tt: number): string | CanvasGradient {
  const color = RARITIES[r].color;
  if (r === 'LR') {
    const g = ctx.createConicGradient(tt * TAU, x + w / 2, y + h / 2);
    PRISM.forEach((c, i) => g.addColorStop(i / (PRISM.length - 1), c));
    return g;
  }
  if (rarityRank(r) >= rarityRank('SR')) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, color);
    g.addColorStop(0.55, shade(color, -0.45));
    g.addColorStop(1, color);
    return g;
  }
  return r === 'C' ? '#6f7783' : color;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export interface CardDrawOpts {
  isNew?: boolean;
  tt: number;
  dark: boolean;
}

export function drawCard(ctx: Ctx, card: Card, art: HTMLImageElement | undefined, x: number, y: number, w: number, o: CardDrawOpts) {
  const u = w / 100;
  const h = (w * 88) / 63;
  const rar = RARITIES[card.rarity];
  const premium = rar.drama >= 2;
  const r = 4.5 * u;

  // sombra + resplandor de rareza
  ctx.save();
  ctx.shadowColor = o.dark ? (premium ? rar.glow : 'rgba(0,0,0,0.6)') : 'rgba(60,40,10,0.45)';
  ctx.shadowBlur = (premium ? 9 : 5) * u;
  ctx.shadowOffsetY = 1.5 * u;
  ctx.fillStyle = '#0d1014';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // marco
  const bw = premium ? 1.6 * u : 1.4 * u;
  ctx.fillStyle = borderPaint(ctx, card.rarity, x, y, w, h, o.tt);
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  const inner = ctx.createLinearGradient(x, y, x, y + h);
  const [c0, c1] = card.rarity === 'UR' ? ['#231d0e', '#0e0c07'] : card.rarity === 'LR' ? ['#1c1022', '#0a070c'] : card.rarity === 'C' ? ['#1a1d22', '#0d0f12'] : ['#1c2129', '#0d1014'];
  inner.addColorStop(0, c0);
  inner.addColorStop(1, c1);
  ctx.fillStyle = inner;
  roundRect(ctx, x + bw, y + bw, w - 2 * bw, h - 2 * bw, r - bw);
  ctx.fill();

  const pad = premium ? 4.6 * u : 3.2 * u;
  const left = x + pad;
  const innerW = w - 2 * pad;

  // cabecera: rareza · código · clase
  const hy = y + pad;
  ctx.font = font(6.4 * u, BEBAS);
  spacing(ctx, 0.2 * u);
  const badgeW = Math.max(11 * u, ctx.measureText(card.rarity).width + 3.4 * u);
  if (card.rarity === 'LR') {
    const g = ctx.createLinearGradient(left, 0, left + badgeW, 0);
    g.addColorStop(0, '#ff8cf0');
    g.addColorStop(0.5, '#ffc845');
    g.addColorStop(1, '#5fe0ff');
    ctx.fillStyle = g;
  } else ctx.fillStyle = rar.color;
  roundRect(ctx, left, hy + 0.5 * u, badgeW, 8 * u, 1.6 * u);
  ctx.fill();
  ctx.fillStyle = '#0b0b0b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(card.rarity, left + badgeW / 2, hy + 4.8 * u);

  const cls = classLabel(card).toUpperCase();
  ctx.font = font(3.1 * u, MONO, 600);
  spacing(ctx, 0.2 * u);
  const pillW = Math.min(30 * u, ctx.measureText(cls).width + 4 * u);
  const pillX = x + w - pad - pillW;
  ctx.strokeStyle = CLASSES[card.cls].color;
  ctx.lineWidth = 0.4 * u;
  roundRect(ctx, pillX, hy + 1.6 * u, pillW, 5.8 * u, 3 * u);
  ctx.stroke();
  ctx.fillStyle = CLASSES[card.cls].color;
  ctx.fillText(cls, pillX + pillW / 2, hy + 4.6 * u, pillW - 2 * u);

  ctx.textAlign = 'left';
  ctx.font = font(7.4 * u, BEBAS);
  spacing(ctx, 0.2 * u);
  ctx.fillStyle = '#f4efe2';
  ctx.fillText(card.code, left + badgeW + 2 * u, hy + 5 * u, pillX - (left + badgeW + 4 * u));

  // arte
  const ay = hy + 9 * u + 1.6 * u;
  const ah = innerW * 0.7;
  ctx.save();
  roundRect(ctx, left, ay, innerW, ah, 2 * u);
  ctx.clip();
  ctx.fillStyle = '#050607';
  ctx.fillRect(left, ay, innerW, ah);
  if (art) ctx.drawImage(art, left, ay, innerW, ah);
  ctx.font = font(innerW * 0.26, BEBAS);
  spacing(ctx, 0);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillText(card.num !== null ? String(card.num).padStart(3, '0') : card.code.replace(/^SCP-/, ''), left + innerW * 0.96, ay + ah * 0.94);
  if (rarityRank(card.rarity) >= rarityRank('SSR')) {
    // holograma en la ventana del arte
    ctx.globalCompositeOperation = 'color-dodge';
    ctx.globalAlpha = card.rarity === 'LR' ? 0.34 : card.rarity === 'UR' ? 0.3 : 0.24;
    const shift = o.tt * innerW * 2;
    const g = ctx.createLinearGradient(left - innerW + shift, ay, left + shift, ay + ah);
    ['#ff3b9a', '#ffd23f', '#3bff9a', '#3bd2ff', '#b03bff', '#ff3b9a'].forEach((c, i) => g.addColorStop(i / 5, c));
    ctx.fillStyle = g;
    ctx.fillRect(left, ay, innerW, ah);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let yy = ay; yy < ay + ah; yy += 0.9 * u) ctx.fillRect(left, yy, innerW, 0.3 * u);
  // nombre
  const ng = ctx.createLinearGradient(0, ay + ah - 16 * u, 0, ay + ah);
  ng.addColorStop(0, 'rgba(0,0,0,0)');
  ng.addColorStop(0.6, 'rgba(0,0,0,0.92)');
  ctx.fillStyle = ng;
  ctx.fillRect(left, ay + ah - 16 * u, innerW, 16 * u);
  const name = cardName(card) || card.code;
  ctx.font = font(5.2 * u, INTER, 800);
  spacing(ctx, 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  const nameLines = wrap(ctx, name, innerW - 4.8 * u, 2);
  nameLines.forEach((ln, i) => ctx.fillText(ln, left + 2.4 * u, ay + ah - 2 * u - (nameLines.length - 1 - i) * 6 * u));
  // índice
  const q = `${t('card.qShort')} ${fmt(card.q, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  ctx.font = font(3 * u, MONO, 600);
  const qw = ctx.measureText(q).width + 3.2 * u;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  roundRect(ctx, left + innerW - qw - 1.6 * u, ay + 1.6 * u, qw, 5 * u, 1 * u);
  ctx.fill();
  ctx.fillStyle = rar.color;
  ctx.fillText(q, left + innerW - qw - 0.0 * u, ay + 5.1 * u);
  ctx.restore();

  // papel del expediente
  const statsH = 10.5 * u;
  const by = ay + ah + 1.6 * u;
  const bh = y + h - pad - statsH - 1.6 * u - by;
  const pg = ctx.createLinearGradient(0, by, 0, by + bh);
  pg.addColorStop(0, '#ebe4d1');
  pg.addColorStop(1, '#d9d0b8');
  ctx.fillStyle = pg;
  roundRect(ctx, left, by, innerW, bh, 1.6 * u);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let yy = by + 4.4 * u; yy < by + bh; yy += 4.6 * u) ctx.fillRect(left, yy, innerW, 0.2 * u);
  const label = `${t('card.description')} `;
  const desc = cardSummary(card) || t('card.expunged');
  const fs = 3.3 * u;
  const lh = fs * 1.38;
  const maxLines = Math.max(1, Math.floor((bh - 3 * u) / lh));
  ctx.font = font(fs, MONO, 600);
  const labelW = ctx.measureText(label).width;
  ctx.font = font(fs, MONO, 400);
  // primera línea con el rótulo en negrita
  const tw = innerW - 5.2 * u;
  const firstLine = wrap(ctx, desc, tw - labelW, 1)[0] ?? '';
  const restText = desc.slice(firstLine.replace(/…$/, '').length).trim();
  const rest = maxLines > 1 && restText ? wrap(ctx, restText, tw, maxLines - 1) : [];
  const bx = left + 2.6 * u;
  let ly = by + 2.2 * u + fs;
  ctx.fillStyle = '#1d1c19';
  ctx.font = font(fs, MONO, 600);
  ctx.fillText(label, bx, ly);
  ctx.font = font(fs, MONO, 400);
  ctx.fillText(rest.length || !restText ? firstLine.replace(/…$/, '') : firstLine, bx + labelW, ly);
  for (const ln of rest) {
    ly += lh;
    ctx.fillText(ln, bx, ly);
  }

  // estadísticas
  const sy = y + h - pad - statsH;
  const half = (innerW - 1.6 * u) / 2;
  [
    { k: 'ATK', v: card.atk, c: '#ff6b7a', x: left },
    { k: 'DEF', v: card.def, c: '#6fb8ff', x: left + half + 1.6 * u },
  ].forEach((st) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, st.x, sy, half, statsH, 1.6 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.3 * u;
    ctx.stroke();
    ctx.font = font(3 * u, MONO, 600);
    spacing(ctx, 0.3 * u);
    const kw = ctx.measureText(st.k).width;
    ctx.font = font(8 * u, BEBAS);
    spacing(ctx, 0.2 * u);
    const value = fmt(st.v);
    const vw = ctx.measureText(value).width;
    const sx = st.x + (half - (kw + 1.6 * u + vw)) / 2;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = st.c;
    ctx.font = font(3 * u, MONO, 600);
    spacing(ctx, 0.3 * u);
    ctx.fillText(st.k, sx, sy + statsH * 0.68);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(8 * u, BEBAS);
    spacing(ctx, 0.2 * u);
    ctx.fillText(value, sx + kw + 1.6 * u, sy + statsH * 0.78);
  });
  spacing(ctx, 0);

  // brillo metálico que recorre la carta
  if (premium) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    const p = ((o.tt * 1.6) % 1.6) - 0.3;
    const g = ctx.createLinearGradient(x + w * (p - 0.25), y, x + w * (p + 0.25), y + h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, card.rarity === 'LR' ? 'rgba(255,170,240,0.18)' : card.rarity === 'UR' ? 'rgba(255,225,150,0.22)' : 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  if (o.isNew) {
    ctx.save();
    ctx.translate(x - 1 * u, y + 1 * u);
    ctx.rotate(-0.14);
    ctx.font = font(3.6 * u, MONO, 700);
    spacing(ctx, 0.5 * u);
    const txt = t('scene.new');
    const nw = ctx.measureText(txt).width + 5 * u;
    ctx.shadowColor = 'rgba(245,197,24,0.6)';
    ctx.shadowBlur = 4 * u;
    ctx.fillStyle = '#f5c518';
    roundRect(ctx, -2 * u, -4 * u, nw, 7 * u, 1.4 * u);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(txt, 0.5 * u, -0.5 * u);
    ctx.restore();
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ───────────────────────────── composición ─────────────────────────────

interface Slot {
  x: number;
  y: number;
  w: number;
}

function layout(n: number, ax: number, ay: number, aw: number, ah: number, gap: number, versus: boolean): Slot[] {
  const ratio = 63 / 88;
  if (versus && n === 2) {
    const vsGap = aw * 0.16;
    const w = Math.min((aw - vsGap) / 2, ah * ratio);
    const hh = w / ratio;
    const top = ay + (ah - hh) / 2;
    const total = 2 * w + vsGap;
    const x0 = ax + (aw - total) / 2;
    return [
      { x: x0, y: top, w },
      { x: x0 + w + vsGap, y: top, w },
    ];
  }
  let best = { cols: 1, w: 0 };
  for (let cols = 1; cols <= Math.min(n, 5); cols++) {
    const rows = Math.ceil(n / cols);
    const w = Math.min((aw - (cols - 1) * gap) / cols, ((ah - (rows - 1) * gap) / rows) * ratio, n === 1 ? aw * 0.74 : Infinity);
    if (w > best.w) best = { cols, w };
  }
  const { cols, w } = best;
  const rows = Math.ceil(n / cols);
  const hh = w / ratio;
  const totalH = rows * hh + (rows - 1) * gap;
  const slots: Slot[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols);
    const rowW = inRow * w + (inRow - 1) * gap;
    for (let c = 0; c < inRow; c++) {
      slots.push({ x: ax + (aw - rowW) / 2 + c * (w + gap), y: ay + (ah - totalH) / 2 + r * (hh + gap), w });
    }
  }
  return slots;
}

/** El resumen de rarezas sólo aporta con varias cartas y fuera del formato versus. */
export const hasSummary = (request: ShareScene['request'], n: number) => n > 1 && !(request.layout === 'versus' && n === 2);

function stampFor(stamp: ShareStamp, best: Rarity, context: string, title: string): string | null {
  const text = (k: ShareStamp) => (k === 'breach' ? t('scene.breach') : k === 'topsecret' ? t('scene.topSecret') : t('card.classified'));
  if (stamp === 'none' || (stamp === 'auto' && context === 'battle')) return null;
  if (stamp !== 'auto') return text(stamp);
  const auto: ShareStamp = best === 'LR' ? 'breach' : rarityRank(best) >= rarityRank('SSR') ? 'topsecret' : 'classified';
  // en automático no repite el título (p. ej. "¡Brecha de contención!" + sello "BRECHA DE CONTENCIÓN")
  const plain = (v: string) => v.toLocaleUpperCase().replace(/[^\p{L}\p{N}]+/gu, '');
  return plain(text(auto)) === plain(title) ? text('topsecret') : text(auto);
}

/** Título por defecto según el contexto y la mejor rareza. */
export function defaultTitle(scene: Pick<ShareScene, 'request' | 'cards'>): string {
  const { request, cards } = scene;
  if (request.title) return request.title;
  if (request.context === 'card' && cards[0]) return cardName(cards[0]) || cards[0].code;
  if (request.context === 'collection') return t('share.title.showcase');
  const best = maxRarity(cards.map((c) => c.rarity));
  if (best === 'LR') return t('share.title.lr');
  if (best === 'UR') return t('share.title.ur');
  if (best === 'SSR') return t('share.title.ssr');
  return t('share.title.pack');
}

function kickerFor(scene: ShareScene): string {
  const r = scene.request;
  if (r.kicker) return r.kicker;
  if (r.context === 'pack' && r.packType) return `${packName(r.packType)} · ${fmtDate(Date.now(), { dateStyle: 'medium' })}`;
  if (r.context === 'card' && scene.cards[0]) return `${t('share.kicker.file')} ${scene.cards[0].code}`;
  if (r.context === 'collection') return t('share.kicker.collection', { n: scene.cards.length });
  return fmtDate(Date.now(), { dateStyle: 'medium' });
}

export function drawScene(ctx: Ctx, W: number, H: number, scene: ShareScene, tt: number, env: Env) {
  const { options, cards, request } = scene;
  const s = W / 1080;
  const story = H / W > 1.6;
  const best = maxRarity(cards.map((c) => c.rarity));
  const accent = RARITIES[best].color;
  const pal = palette(options.theme, accent);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  background(ctx, W, H, options.theme, accent, tt, s);

  // márgenes (las historias dejan libres las zonas de la interfaz de Instagram/WhatsApp)
  const side = 64 * s;
  const top = (story ? 230 : options.theme === 'alert' ? 74 : 56) * s;
  const bottomSafe = (story ? 300 : options.theme === 'alert' ? 70 : 52) * s;

  // marca
  let y = top;
  drawEmblem(ctx, side + 22 * s, y + 22 * s, 44 * s, pal.dark ? '#ece7da' : '#1d1c19', '#ff3b4e');
  ctx.font = font(40 * s, BEBAS);
  spacing(ctx, 6 * s);
  ctx.fillStyle = pal.ink;
  ctx.fillText('SCP//GACHA', side + 58 * s, y + 37 * s);
  spacing(ctx, 3 * s);
  ctx.font = font(21 * s, MONO, 600);
  ctx.textAlign = 'right';
  ctx.fillStyle = pal.accent;
  ctx.fillText(kickerFor(scene).toUpperCase(), W - side, y + 33 * s, W - side * 2 - 320 * s);
  ctx.textAlign = 'left';
  y += 70 * s;
  ctx.fillStyle = pal.dark ? 'rgba(255,255,255,0.14)' : 'rgba(29,28,25,0.3)';
  ctx.fillRect(side, y, W - side * 2, 2 * s);
  y += 26 * s;

  // distintivo de combate
  if (request.badge) {
    const tone = { win: '#43d39e', loss: '#ff6b7a', draw: '#f5c518', info: pal.accent }[request.badge.tone];
    ctx.font = font(30 * s, MONO, 700);
    spacing(ctx, 6 * s);
    const bwid = ctx.measureText(request.badge.text).width + 44 * s;
    ctx.strokeStyle = tone;
    ctx.lineWidth = 3 * s;
    ctx.fillStyle = `${tone}22`;
    roundRect(ctx, side, y, bwid, 50 * s, 25 * s);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone;
    ctx.fillText(request.badge.text, side + 22 * s, y + 36 * s);
    y += 66 * s;
  }

  // título
  const title = (options.title || defaultTitle(scene)).toUpperCase();
  const titlePx = fit(ctx, title, W - side * 2, (story ? 132 : 112) * s, 46 * s, BEBAS);
  spacing(ctx, 2 * s);
  ctx.font = font(titlePx, BEBAS);
  if (pal.dark) {
    ctx.shadowColor = `${pal.accent}aa`;
    ctx.shadowBlur = 26 * s;
  }
  ctx.fillStyle = pal.ink;
  y += titlePx * 0.86;
  ctx.fillText(title, side, y, W - side * 2);
  ctx.shadowBlur = 0;
  y += 30 * s;

  // pie (se calcula antes para saber cuánto alto queda para las cartas)
  const summary = options.summary && hasSummary(request, cards.length);
  const footerH = (summary ? 64 : 0) * s + 96 * s;
  const areaTop = y;
  const areaBottom = H - bottomSafe - footerH;
  const gap = 26 * s;
  const versus = request.layout === 'versus' && cards.length === 2;
  const slots = layout(cards.length, side, areaTop, W - side * 2, areaBottom - areaTop, gap, versus);

  // rayos detrás de la mejor carta
  const bestIdx = cards.findIndex((c) => c.rarity === best);
  if (bestIdx >= 0 && rarityRank(best) >= rarityRank('UR')) {
    const sl = slots[bestIdx];
    const cx = sl.x + sl.w / 2;
    const cy = sl.y + sl.w / (63 / 88) / 2;
    const R = sl.w * 1.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((tt * TAU) / 8);
    ctx.globalAlpha = pal.dark ? 0.5 : 0.35;
    for (let i = 0; i < 16; i++) {
      ctx.rotate(TAU / 16);
      const g = ctx.createLinearGradient(0, 0, R, 0);
      const col = best === 'LR' ? PRISM[i % 5] : '#ffc845';
      g.addColorStop(0, `${col}aa`);
      g.addColorStop(1, `${col}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(R, -R * 0.09);
      ctx.lineTo(R, R * 0.09);
      ctx.fill();
    }
    ctx.restore();
  }

  // cartas
  cards.forEach((card, i) => {
    const sl = slots[i];
    if (!sl) return;
    if (!pal.dark) {
      // cinta adhesiva en las esquinas (estilo expediente)
      ctx.save();
      ctx.fillStyle = 'rgba(245,240,220,0.65)';
      for (const [dx, rot] of [
        [0.08, -0.5],
        [0.92, 0.5],
      ] as const) {
        ctx.save();
        ctx.translate(sl.x + sl.w * dx, sl.y);
        ctx.rotate(rot);
        ctx.fillRect(-sl.w * 0.12, -sl.w * 0.03, sl.w * 0.24, sl.w * 0.07);
        ctx.restore();
      }
      ctx.restore();
    }
    drawCard(ctx, card, env.arts.get(card.id), sl.x, sl.y, sl.w, { tt: (tt + i * 0.13) % 1, dark: pal.dark, isNew: request.newIds?.includes(card.id) });
  });

  if (versus) {
    const a = slots[0];
    const b = slots[1];
    const cx = (a.x + a.w + b.x) / 2;
    const cy = a.y + a.w / (63 / 88) / 2;
    const px = Math.min(150 * s, (b.x - (a.x + a.w)) * 0.95);
    ctx.font = font(px, BEBAS);
    spacing(ctx, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff3b4e';
    ctx.shadowBlur = 30 * s * (0.7 + 0.3 * Math.sin(tt * TAU));
    ctx.fillStyle = '#ff3b4e';
    ctx.fillText('VS', cx, cy);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // sello: en diagonal sobre la ilustración de la mejor carta, como sobre la foto de un expediente
  // (no tapa código, nombre, descripción ni estadísticas)
  const stamp = stampFor(options.stamp, best, request.context, options.title || defaultTitle(scene));
  const target = slots[Math.max(0, bestIdx)];
  if (stamp && target) {
    ctx.save();
    let px = 68 * s;
    ctx.font = font(px, BEBAS);
    spacing(ctx, px * 0.08);
    const natural = ctx.measureText(stamp).width + px * 0.6;
    px *= Math.min(1, (target.w * 1.02) / natural);
    ctx.font = font(px, BEBAS);
    spacing(ctx, px * 0.08);
    const sw = ctx.measureText(stamp).width + px * 0.6;
    const sh = px * 1.15;
    ctx.translate(target.x + target.w * 0.55, target.y + (target.w / (63 / 88)) * 0.34);
    ctx.rotate(-0.2);
    // siempre encima del arte oscuro de la carta: sin 'multiply' (lo volvería invisible en el estilo expediente)
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 10 * s;
    ctx.strokeStyle = '#e0202f';
    ctx.lineWidth = 6 * s;
    roundRect(ctx, -sw / 2, -sh / 2, sw, sh, 8 * s);
    ctx.stroke();
    ctx.lineWidth = 2 * s;
    roundRect(ctx, -sw / 2 + 9 * s, -sh / 2 + 9 * s, sw - 18 * s, sh - 18 * s, 4 * s);
    ctx.stroke();
    ctx.fillStyle = '#e0202f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stamp, 0, px * 0.05);
    ctx.restore();
  }

  // pie
  let fy = H - bottomSafe - footerH + 20 * s;
  if (summary) {
    const counts = [...RARITY_ORDER].reverse().map((r) => ({ r, n: cards.filter((c) => c.rarity === r).length })).filter((x) => x.n > 0);
    ctx.font = font(26 * s, MONO, 600);
    spacing(ctx, 2 * s);
    const items = counts.map((c) => ({ ...c, text: `${c.r} ×${c.n}`, w: ctx.measureText(`${c.r} ×${c.n}`).width + 36 * s }));
    const totalW = items.reduce((a, it) => a + it.w, 0) + (items.length - 1) * 12 * s;
    let fx = (W - totalW) / 2;
    for (const it of items) {
      const col = RARITIES[it.r].color;
      ctx.fillStyle = pal.dark ? `${col}22` : 'rgba(29,28,25,0.85)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2 * s;
      roundRect(ctx, fx, fy, it.w, 44 * s, 22 * s);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillText(it.text, fx + 18 * s, fy + 31 * s);
      fx += it.w + 12 * s;
    }
    fy += 64 * s;
  }
  ctx.fillStyle = pal.dark ? 'rgba(255,255,255,0.14)' : 'rgba(29,28,25,0.3)';
  ctx.fillRect(side, fy, W - side * 2, 2 * s);
  fy += 44 * s;
  ctx.font = font(24 * s, MONO, 600);
  spacing(ctx, 3 * s);
  ctx.fillStyle = pal.ink;
  if (options.handle.trim()) ctx.fillText(`${t('share.agent')} ${options.handle.trim()}`.toUpperCase(), side, fy, W * 0.55);
  ctx.textAlign = 'right';
  ctx.fillStyle = pal.accent;
  ctx.fillText('#SCPGACHA', W - side, fy);
  ctx.textAlign = 'center';
  ctx.font = font(16 * s, MONO, 400);
  spacing(ctx, 1 * s);
  ctx.fillStyle = pal.dim;
  ctx.fillText(t('share.license'), W / 2, fy + 34 * s, W - side * 2);
  ctx.textAlign = 'left';
  spacing(ctx, 0);
  ctx.restore();
}

/** Semilla estable por solicitud (para que el fondo no cambie entre vista previa y exportación). */
export const sceneSeed = (scene: ShareScene) => hash32(scene.cards.map((c) => c.id).join());
