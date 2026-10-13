export type Rarity = 'C' | 'UC' | 'R' | 'SR' | 'SSR' | 'UR' | 'LR';

export type ObjClass =
  | 'safe'
  | 'euclid'
  | 'keter'
  | 'thaumiel'
  | 'apollyon'
  | 'archon'
  | 'esoteric'
  | 'neutralized'
  | 'explained'
  | 'pending'
  | 'decommissioned'
  | 'unknown';

export interface Card {
  /** slug de la wiki, p. ej. "scp-173" */
  id: string;
  /** designación, p. ej. "SCP-173" */
  code: string;
  num: number | null;
  /** apodo, p. ej. "The Sculpture" */
  name: string;
  cls: ObjClass;
  /** nombre de la clase esotérica cuando cls === 'esoteric' (p. ej. "ticonderoga") */
  clsLabel: string;
  rarity: Rarity;
  /** Índice de Notoriedad 0–100 */
  q: number;
  atk: number;
  def: number;
  rating: number;
  series: string;
  author: string;
  year: number | null;
  tags: string[];
  desc: string;
}

export type PackType = 'standard' | 'pity' | 'thaumiel' | 'o5';
