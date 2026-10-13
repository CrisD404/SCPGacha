import { es } from './es';
import { en } from './en';
import { getLang, LANGS, useLang, type Lang } from './lang';

export type Key = keyof typeof es;
type Params = Record<string, string | number>;

const DICTS: Record<Lang, Record<Key, string>> = { es, en };

export const locale = () => LANGS.find((l) => l.id === getLang())!.locale;

export const fmt = (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(locale(), opts);

export const fmtDate = (ms: number, opts?: Intl.DateTimeFormatOptions) => new Date(ms).toLocaleString(locale(), opts);

/** Traduce una clave del diccionario; {param} se reemplaza (los números se formatean según el idioma). */
export function t(key: Key, params?: Params): string {
  let s: string = DICTS[getLang()][key] ?? es[key] ?? key;
  if (params) {
    s = s.replace(/\{(\w+)\}/g, (m, k: string) => {
      const v = params[k];
      if (v === undefined) return m;
      return typeof v === 'number' ? fmt(v) : v;
    });
  }
  return s;
}

/** Para claves armadas en tiempo de ejecución (ids de trofeos, clases, etc.). */
export const tk = (key: string, params?: Params) => t(key as Key, params);

export const hasKey = (key: string): key is Key => key in es;

/** Hook: re-renderiza el componente cuando cambia el idioma. */
export function useT() {
  const lang = useLang((s) => s.lang);
  return { t, tk, fmt, fmtDate, lang };
}

export { useLang, getLang, LANGS, type Lang };
