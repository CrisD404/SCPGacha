import type { ObjClass } from './types';

export interface ClassInfo {
  id: ObjClass;
  color: string;
}

// Nombres, habilidades y descripciones visibles están en src/i18n (class.<id>.*).
export const CLASSES: Record<ObjClass, ClassInfo> = {
  safe: { id: 'safe', color: '#43d39e' },
  euclid: { id: 'euclid', color: '#ffc845' },
  keter: { id: 'keter', color: '#ff4d5e' },
  thaumiel: { id: 'thaumiel', color: '#c7a2ff' },
  apollyon: { id: 'apollyon', color: '#ff2a2a' },
  archon: { id: 'archon', color: '#ff9b3d' },
  esoteric: { id: 'esoteric', color: '#5fe0ff' },
  neutralized: { id: 'neutralized', color: '#8f96a3' },
  explained: { id: 'explained', color: '#d9d3c3' },
  pending: { id: 'pending', color: '#e8e4d8' },
  decommissioned: { id: 'decommissioned', color: '#b0844f' },
  unknown: { id: 'unknown', color: '#9aa3b2' },
};

export const CLASS_ORDER: ObjClass[] = [
  'safe', 'euclid', 'keter', 'thaumiel', 'apollyon', 'archon', 'esoteric', 'neutralized', 'explained', 'pending', 'decommissioned', 'unknown',
];
