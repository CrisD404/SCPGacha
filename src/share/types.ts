import type { Card, PackType } from '../data/types';

/** Lo que una pantalla pide compartir. El estudio permite elegir qué cartas incluir. */
export interface ShareRequest {
  context: 'pack' | 'collection' | 'card' | 'battle';
  cards: Card[];
  /** cartas preseleccionadas (por defecto, todas) */
  selected?: string[];
  /** título sugerido (editable) */
  title?: string;
  /** línea superior: tipo de paquete, modo de combate… */
  kicker?: string;
  /** distintivo grande opcional: VICTORIA, DERROTA… */
  badge?: { text: string; tone: 'win' | 'loss' | 'draw' | 'info' };
  /** 'versus': dos cartas enfrentadas (duelo) */
  layout?: 'auto' | 'versus';
  packType?: PackType;
  /** ids de cartas nuevas (insignia NUEVA) */
  newIds?: string[];
}

export type ShareFormat = 'square' | 'portrait' | 'story';
export type ShareTheme = 'archive' | 'alert' | 'thaumiel' | 'dossier';
export type ShareOutput = 'png' | 'gif' | 'video';
export type ShareStamp = 'auto' | 'none' | 'classified' | 'topsecret' | 'breach';

export interface ShareOptions {
  format: ShareFormat;
  theme: ShareTheme;
  output: ShareOutput;
  stamp: ShareStamp;
  summary: boolean;
  handle: string;
  title: string;
}

export const FORMATS: Record<ShareFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

/** Todo lo necesario para dibujar un fotograma. */
export interface ShareScene {
  request: ShareRequest;
  cards: Card[];
  options: ShareOptions;
}
