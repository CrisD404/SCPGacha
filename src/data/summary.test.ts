import { describe, expect, it } from 'vitest';
import { sentences, summarize } from './summary';

describe('sentences', () => {
  it('respeta abreviaturas, iniciales y decimales', () => {
    expect(sentences('Dr. J. Smith measured 2.38 m. It is red. Approx. 5 kg.')).toEqual(['Dr. J. Smith measured 2.38 m.', 'It is red.', 'Approx. 5 kg.']);
    expect(sentences('Lo halló la Dra. Ruiz en EE. UU. y aprox. a las 3. ¿Por qué? Nadie sabe.')).toEqual(['Lo halló la Dra. Ruiz en EE. UU. y aprox. a las 3.', '¿Por qué?', 'Nadie sabe.']);
  });

  it('separa párrafos y elementos de lista (sin la viñeta)', () => {
    expect(sentences('First one.\n\nSecond one.')).toEqual(['First one.', 'Second one.']);
    expect(sentences('It has two parts:\n• A red lamp\n• A house.')).toEqual(['It has two parts:', 'A red lamp', 'A house.']);
  });
});

describe('summarize', () => {
  const s096 =
    'SCP-096 is a humanoid creature measuring approximately 2.38 meters in height. Subject shows very little muscle mass, with preliminary analysis of body mass suggesting mild malnutrition.\n\nSCP-096 is normally very docile.';

  it('usa oraciones completas mientras quepan', () => {
    expect(summarize(s096, 100)).toBe('SCP-096 is a humanoid creature measuring approximately 2.38 meters in height.');
    expect(summarize('Short. Text.', 200)).toBe('Short. Text.');
  });

  it('si la primera oración no cabe, corta en una pausa natural y cierra con punto', () => {
    const long = 'SCP-1234 is a large wooden chest of drawers manufactured in the late eighteenth century, which emits a faint humming sound whenever a drawer is opened by a person who has not slept.';
    expect(summarize(long, 120)).toBe('SCP-1234 is a large wooden chest of drawers manufactured in the late eighteenth century.');
    const paren = 'SCP-5678 es una estatua de bronce de tamaño natural que representa a un hombre sentado (aproximadamente 1,4 m de alto y 340 kg de peso) sobre un banco de piedra.';
    expect(summarize(paren, 110)).toBe('SCP-5678 es una estatua de bronce de tamaño natural que representa a un hombre sentado.');
  });

  it('último recurso: corte por palabra con puntos suspensivos', () => {
    const out = summarize('Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua', 60);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out).not.toMatch(/\s…$/);
  });

  it('cierra los elementos de lista sin puntuación', () => {
    expect(summarize('It has two parts:\n• A red lamp\n• A house', 200)).toBe('It has two parts: A red lamp; A house.');
  });

  it('nunca supera el máximo', () => {
    for (const max of [60, 120, 200]) expect(summarize(s096, max).length).toBeLessThanOrEqual(max);
  });
});
