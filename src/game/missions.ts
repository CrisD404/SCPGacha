import type { MissionId } from '../store/save';

export interface MissionDef {
  id: MissionId;
  target: number;
}

// Textos visibles: src/i18n (mission.<id>).
export const MISSIONS: MissionDef[] = [
  { id: 'open5', target: 5 },
  { id: 'srplus', target: 1 },
  { id: 'read', target: 1 },
  { id: 'share', target: 1 },
  { id: 'win', target: 1 },
];

export const missionDef = (id: MissionId) => MISSIONS.find((m) => m.id === id)!;
