import { Fragment, type ReactNode } from 'react';
import { fmt, t, useT, type Key } from './index';

type Values = Record<string, ReactNode | string | number>;

/** Renderiza un texto traducido con **negritas** y {marcadores} que pueden ser nodos React. */
export function Trans({ k, values }: { k: Key; values?: Values }) {
  useT();
  return <>{rich(t(k), values)}</>;
}

export function rich(text: string, values: Values = {}): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  for (const part of text.split(/(\*\*[^*]+\*\*|\{\w+\})/g)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**')) {
      out.push(<b key={i++}>{rich(part.slice(2, -2), values)}</b>);
    } else if (/^\{\w+\}$/.test(part) && part.slice(1, -1) in values) {
      const v = values[part.slice(1, -1)];
      out.push(<Fragment key={i++}>{typeof v === 'number' ? fmt(v) : v}</Fragment>);
    } else {
      out.push(<Fragment key={i++}>{part}</Fragment>);
    }
  }
  return out;
}
