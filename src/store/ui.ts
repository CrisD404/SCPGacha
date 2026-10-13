import { create } from 'zustand';
import type { IconName } from '../components/Icon';
import type { InsigniaTier } from '../components/Insignia';
import type { ShareRequest } from '../share/types';

export type NoticeKind = 'trophy' | 'mission' | 'reward' | 'info';

export interface Notice {
  id: number;
  kind: NoticeKind;
  icon: IconName;
  tier: InsigniaTier;
  /** rótulo de la insignia (p. ej. "SSR", "100") */
  label?: string;
  title: string;
  text?: string;
  /** dato breve junto al encabezado (p. ej. progreso "5/71") */
  meta?: string;
}

export type NoticeInput = Omit<Notice, 'id' | 'tier'> & { tier?: InsigniaTier };

const DEFAULT_TIER: Record<NoticeKind, InsigniaTier> = { trophy: 'gold', mission: 'mission', reward: 'reward', info: 'info' };

interface UiState {
  /** notificación visible (sólo una a la vez) */
  notice: Notice | null;
  /** notificaciones en espera, en orden de llegada */
  queue: Notice[];
  notify: (n: NoticeInput) => void;
  nextNotice: () => void;
  detailCardId: string | null;
  openDetail: (id: string | null) => void;
  modal: 'trophies' | 'rules' | null;
  setModal: (m: UiState['modal']) => void;
  /** estudio de compartir abierto */
  share: ShareRequest | null;
  openShare: (req: ShareRequest) => void;
  closeShare: () => void;
}

let nextId = 1;

export const useUi = create<UiState>((set) => ({
  notice: null,
  queue: [],
  notify: (n) => {
    const item: Notice = { ...n, tier: n.tier ?? DEFAULT_TIER[n.kind], id: nextId++ };
    set((s) => (s.notice ? { queue: [...s.queue, item] } : { notice: item }));
  },
  nextNotice: () => set((s) => ({ notice: s.queue[0] ?? null, queue: s.queue.slice(1) })),
  detailCardId: null,
  openDetail: (id) => set({ detailCardId: id }),
  modal: null,
  setModal: (modal) => set({ modal }),
  share: null,
  openShare: (share) => set({ share }),
  closeShare: () => set({ share: null }),
}));

export const notify = (n: NoticeInput) => useUi.getState().notify(n);
