/**
 * Resumen coherente de una descripción para la cara de la carta.
 *
 * La descripción guardada puede tener varios párrafos (la vista expandida la muestra entera);
 * en la carta sólo entran unas pocas líneas. Criterio, en orden:
 *  1. Oraciones completas desde el principio, mientras quepan.
 *  2. Si la primera oración ya no cabe, se corta en una pausa natural que deja una idea completa
 *     (antes de ", which…", ", y…", "(…)", "; " o " — ") y se cierra con punto.
 *  3. Último recurso: corte por palabra con "…".
 * Funciona igual en inglés y en español (la traducción se resume con el mismo criterio).
 */

/** Abreviaturas que terminan en punto sin cerrar la oración (inglés y español). */
const ABBREV = new Set(
  [
    'dr', 'mr', 'mrs', 'ms', 'mx', 'st', 'mt', 'jr', 'sr', 'sra', 'srta', 'dra', 'lt', 'col', 'gen', 'sgt', 'capt', 'prof', 'rev', 'no', 'nº', 'núm',
    'vs', 'etc', 'approx', 'aprox', 'ca', 'inc', 'ltd', 'co', 'cía', 'fig', 'vol', 'pág', 'av', 'ing', 'lic', 'ee', 'uu', 'e.g', 'i.e', 'u.s', 'u.k', 'p. ej', 'ej',
  ],
);

/** Pausas tras las que lo que sigue es un agregado: cortar ahí no cambia el sentido de lo anterior. */
const CLAUSE =
  /,\s+(?=(?:which|who|whose|with|and|measuring|approximately|consisting|located|containing|appearing|where|que|quien|quienes|cuyo|cuya|cuyos|cuyas|con|y|el cual|la cual|los cuales|las cuales|de aproximadamente|aproximadamente|ubicad[oa]s?|situad[oa]s?|donde|compuest[oa]s?|formad[oa]s?|hech[oa]s?)\b)|;\s+|\s+[—–]\s+|\s+\(/gi;

/**
 * Divide en oraciones respetando abreviaturas, iniciales ("J. R.") y números decimales.
 * Cada línea (párrafo o elemento de lista "• …") cierra oración; la viñeta se descarta.
 */
export function sentences(text: string): string[] {
  const out: string[] = [];
  const end = /[.!?…]+["'”»)\]]*(?=\s+["'“«(¿¡]?[\p{Lu}\d█[])/gu;
  for (const line of text.split(/\n+/)) {
    const flat = line.replace(/^\s*•\s*/, '').trim();
    let start = 0;
    for (const m of flat.matchAll(end)) {
      const stop = m.index + m[0].length;
      if (m[0].startsWith('.')) {
        const raw = /([\p{L}.]+)\.$/u.exec(flat.slice(start, m.index + 1))?.[1] ?? '';
        // abreviatura conocida o inicial de un nombre ("J."); una minúscula suelta ("2 m.") sí cierra la oración
        if (ABBREV.has(raw.toLowerCase()) || /^\p{Lu}$/u.test(raw)) continue;
      }
      out.push(flat.slice(start, stop).trim());
      start = stop;
    }
    const rest = flat.slice(start).trim();
    if (rest) out.push(rest);
  }
  return out;
}

/** Corta la oración en la última pausa natural que deje al menos el 40 % del espacio usado. */
function clauseCut(sentence: string, max: number): string | null {
  const room = sentence.slice(0, max);
  let best = -1;
  for (const m of room.matchAll(CLAUSE)) if (m.index >= max * 0.4) best = m.index;
  if (best < 0) return null;
  return `${sentence.slice(0, best).replace(/[,;:\s]+$/, '')}.`;
}

export function summarize(text: string, max: number): string {
  const all = sentences(text);
  if (!all.length) return '';
  // los elementos de lista suelen no llevar puntuación: se cierran con ";" (o "." el último)
  const closed = (s: string) => (/[.!?…:;"'”»)\]]$/.test(s) ? s : `${s};`);
  const taken: string[] = [];
  let len = 0;
  for (const s of all) {
    const piece = closed(s);
    if (len + piece.length + (taken.length ? 1 : 0) > max) break;
    taken.push(piece);
    len += piece.length + (taken.length > 1 ? 1 : 0);
  }
  // no termina en una frase que anuncia algo que no se muestra ("To clarify:", "Lo siguiente:")
  while (taken.length > 1 && /:\s*$/.test(taken[taken.length - 1])) taken.pop();
  if (taken.length) return taken.join(' ').replace(/;$/, '.');
  const first = all[0];
  const clause = clauseCut(first, max);
  if (clause) return clause;
  const room = first.slice(0, max - 1);
  const space = room.lastIndexOf(' ');
  return `${room.slice(0, space > max * 0.5 ? space : room.length).replace(/[,;:\s]+$/, '')}…`;
}
