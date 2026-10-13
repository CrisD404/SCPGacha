import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

export type Lang = 'es' | 'en';

export const LANGS: { id: Lang; label: string; short: string; locale: string }[] = [
  { id: 'es', label: 'Español (Latinoamérica)', short: 'ES', locale: 'es-419' },
  { id: 'en', label: 'English', short: 'EN', locale: 'en-US' },
];

/** Idioma inicial: el del navegador si es español o inglés; si no, inglés. */
function detect(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.languages?.[0] ?? navigator.language : 'es';
  return /^es\b/i.test(nav ?? '') ? 'es' : 'en';
}

const memory = new Map<string, string>();
const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      memory.set(k, v);
    }
  },
  removeItem: (k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      memory.delete(k);
    }
  },
};

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

/**
 * Preferencia de idioma del dispositivo. Vive fuera de la partida para que
 * importar un respaldo (o sincronizar en el futuro) no cambie el idioma.
 */
export const useLang = create<LangState>()(
  persist((set) => ({ lang: detect(), setLang: (lang) => set({ lang }) }), {
    name: 'scp-gacha-lang',
    storage: createJSONStorage(() => safeStorage),
  }),
);

export const getLang = (): Lang => useLang.getState().lang;
