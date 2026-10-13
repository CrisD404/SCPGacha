import { useDeferredValue, useMemo, useState } from 'react';
import type { Card } from '../../data/types';
import { cardName, cards } from '../../data/cards';
import { useT, type Key } from '../../i18n';
import { rarityRank } from '../../data/rarity';
import { useSave } from '../../store/game';
import { CardMini } from '../../components/Card';

type Sort = 'rarity' | 'atk' | 'def' | 'total' | 'fav' | 'level';

interface Props {
  max: number;
  selected: string[];
  onChange: (ids: string[]) => void;
  /** muestra el nivel de Recontención */
  showLevels?: boolean;
}

/** Selector de cartas de la colección (ordenado: el orden de selección es el orden de combate). */
export function CardPicker({ max, selected, onChange, showLevels }: Props) {
  const db = cards();
  const collection = useSave((s) => s.collection);
  const levels = useSave((s) => s.story.levels);
  const [sort, setSort] = useState<Sort>(showLevels ? 'level' : 'total');
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [limit, setLimit] = useState(48);
  const { t, fmt } = useT();

  const list = useMemo(() => {
    const query = dq.trim().toLowerCase();
    const owned = Object.keys(collection)
      .map((id) => db.byId.get(id))
      .filter((c): c is Card => !!c)
      .filter((c) => !query || `${c.code} ${c.name} ${cardName(c)}`.toLowerCase().includes(query));
    const key = (c: Card) => {
      switch (sort) {
        case 'rarity':
          return rarityRank(c.rarity) * 100000 + c.atk + c.def;
        case 'atk':
          return c.atk;
        case 'def':
          return c.def;
        case 'fav':
          return (collection[c.id]?.fav ? 1e6 : 0) + c.atk + c.def;
        case 'level':
          return (levels[c.id] ?? 1) * 1e5 + c.atk + c.def;
        default:
          return c.atk + c.def;
      }
    };
    return owned.sort((a, b) => key(b) - key(a));
  }, [db, collection, levels, dq, sort]);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (max === 1) onChange([id]);
    else if (selected.length < max) onChange([...selected, id]);
  };

  if (!list.length && !dq)
    return <div className="empty-note">{t('picker.empty')}</div>;

  const sorts: { id: Sort; label: Key }[] = [
    { id: 'total', label: 'col.sort.total' },
    { id: 'rarity', label: 'col.sort.rarity' },
    { id: 'atk', label: 'col.sort.atk' },
    { id: 'def', label: 'col.sort.def' },
    { id: 'fav', label: 'col.favorites' },
    ...(showLevels ? [{ id: 'level' as Sort, label: 'picker.level' as Key }] : []),
  ];

  return (
    <div className="picker">
      <div className="row picker-tools">
        <input className="field grow" placeholder={t('picker.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row" style={{ gap: 6 }}>
          {sorts.map((s) => (
            <button key={s.id} className={`chip ${sort === s.id ? 'on' : ''}`} onClick={() => setSort(s.id)}>
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="picker-grid">
        {list.slice(0, limit).map((c) => {
          const idx = selected.indexOf(c.id);
          const lvl = levels[c.id] ?? 1;
          return (
            <div key={c.id} className="picker-item">
              <CardMini card={c} selected={idx >= 0} onClick={() => toggle(c.id)} badge={idx >= 0 && max > 1 ? `#${idx + 1}` : showLevels && lvl > 1 ? `${t('card.lvShort')} ${lvl}` : undefined} />
              <div className="picker-stats mono">
                <span className="atk">{fmt(c.atk)}</span>
                <span className="def">{fmt(c.def)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {list.length > limit && (
        <button className="btn btn-sm" style={{ alignSelf: 'center' }} onClick={() => setLimit(limit + 48)}>
          {t('picker.more', { n: list.length - limit })}
        </button>
      )}
    </div>
  );
}
