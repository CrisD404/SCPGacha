import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Card } from '../data/types';
import { CardArt } from '../components/CardArt';

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Rasteriza el arte procedural de una carta (el mismo SVG del juego) como imagen para el canvas. */
export function loadArt(card: Card): Promise<HTMLImageElement> {
  let p = cache.get(card.id);
  if (!p) {
    const svg = renderToStaticMarkup(createElement(CardArt, { card, bare: true })).replace('<svg ', '<svg width="1000" height="700" ');
    p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`art ${card.id}`));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    cache.set(card.id, p);
  }
  return p;
}

/** Fuentes del juego: el canvas sólo las usa si ya están cargadas. */
export async function loadFonts(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all(
    ['400 64px "Bebas Neue"', '400 32px "IBM Plex Mono"', '600 32px "IBM Plex Mono"', '700 32px "Inter Variable"', '800 32px "Inter Variable"'].map((f) =>
      document.fonts.load(f).catch(() => undefined),
    ),
  );
}
