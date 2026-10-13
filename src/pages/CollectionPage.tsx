import { useDeferredValue, useMemo, useRef, useState } from 'react';
import type { Card, ObjClass, Rarity } from '../data/types';
import { cardName, cards } from '../data/cards';
import { RARITIES, RARITY_ORDER, rarityRank } from '../data/rarity';
import { CLASSES, CLASS_ORDER } from '../data/classes';
import { useGame, useSave } from '../store/game';
import { useUi } from '../store/ui';
import type { OwnedCard } from '../store/save';
import { CardFace, CardMini } from '../components/Card';
import { Modal } from '../components/Modal';
import { BackupError, decodeBackup, encodeBackup } from '../game/backup';
import { copyText } from '../clipboard';
import { ShareButton } from '../components/ShareButton';
import { Icon } from '../components/Icon';
import { useT, type Key } from '../i18n';
import { Trans } from '../i18n/Trans';
import { classLabel, className } from '../i18n/labels';
import './collection.css';

type SortKey = 'rarity' | 'class' | 'name' | 'num' | 'atk' | 'def' | 'total' | 'count' | 'date';
const SORTS: { id: SortKey; label: Key }[] = [
  { id: 'rarity', label: 'col.sort.rarity' },
  { id: 'num', label: 'col.sort.num' },
  { id: 'name', label: 'col.sort.name' },
  { id: 'class', label: 'col.sort.class' },
  { id: 'atk', label: 'col.sort.atk' },
  { id: 'def', label: 'col.sort.def' },
  { id: 'total', label: 'col.sort.total' },
  { id: 'count', label: 'col.sort.count' },
  { id: 'date', label: 'col.sort.date' },
];
const PAGE = 60;

interface Row {
  card: Card;
  owned?: OwnedCard;
}

function compare(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case 'rarity':
      return rarityRank(a.card.rarity) - rarityRank(b.card.rarity) || a.card.q - b.card.q;
    case 'class':
      return CLASS_ORDER.indexOf(a.card.cls) - CLASS_ORDER.indexOf(b.card.cls);
    case 'name':
      return (cardName(b.card) || b.card.code).localeCompare(cardName(a.card) || a.card.code);
    case 'num':
      return (b.card.num ?? 1e9) - (a.card.num ?? 1e9);
    case 'atk':
      return a.card.atk - b.card.atk;
    case 'def':
      return a.card.def - b.card.def;
    case 'total':
      return a.card.atk + a.card.def - (b.card.atk + b.card.def);
    case 'count':
      return (a.owned?.n ?? 0) - (b.owned?.n ?? 0);
    case 'date':
      return (a.owned?.first ?? 0) - (b.owned?.first ?? 0);
  }
}

export function CollectionPage() {
  const db = cards();
  const collection = useSave((s) => s.collection);
  const packsOpened = useSave((s) => s.packsOpened);
  const cardsPulled = useSave((s) => s.cardsPulled);
  const toggleFav = useGame((s) => s.toggleFav);
  const openDetail = useUi((s) => s.openDetail);
  const { t, fmt, lang } = useT();

  const [sort, setSort] = useState<SortKey>('rarity');
  const [desc, setDesc] = useState(true);
  const [favOnly, setFavOnly] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [cls, setCls] = useState<ObjClass | ''>('');
  const [query, setQuery] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [showcase, setShowcase] = useState(false);
  const dq = useDeferredValue(query);
  const dtq = useDeferredValue(tagQuery);

  const owned = useMemo(() => Object.keys(collection).filter((id) => db.byId.has(id)), [collection, db]);
  const stats = useMemo(() => {
    const by = Object.fromEntries(RARITY_ORDER.map((r) => [r, 0])) as Record<Rarity, number>;
    for (const id of owned) by[db.byId.get(id)!.rarity]++;
    return by;
  }, [owned, db]);

  const rows = useMemo(() => {
    const q = dq.trim().toLowerCase();
    const tq = dtq.trim().toLowerCase();
    const base: Row[] = showMissing ? db.all.map((card) => ({ card, owned: collection[card.id] })) : owned.map((id) => ({ card: db.byId.get(id)!, owned: collection[id] }));
    const filtered = base.filter(({ card, owned: o }) => {
      if (favOnly && !o?.fav) return false;
      if (rarities.length && !rarities.includes(card.rarity)) return false;
      if (cls && card.cls !== cls) return false;
      if (q) {
        // se busca en el apodo original y en el traducido
        const hay = `${card.code} ${o ? `${card.name} ${cardName(card)}` : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (tq && !(o && (card.tags.some((tag) => tag.includes(tq)) || classLabel(card).toLowerCase().includes(tq) || card.cls.includes(tq)))) return false;
      return true;
    });
    filtered.sort((a, b) => {
      const c = compare(a, b, sort) || (a.card.num ?? 1e9) - (b.card.num ?? 1e9);
      return desc ? -c : c;
    });
    return filtered;
    // lang: el orden por nombre depende del idioma
  }, [db, owned, collection, showMissing, favOnly, rarities, cls, dq, dtq, sort, desc, lang]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const curPage = Math.min(page, pages);
  const visible = rows.slice((curPage - 1) * PAGE, curPage * PAGE);

  const chooseSort = (k: SortKey) => {
    if (k === sort) setDesc(!desc);
    else {
      setSort(k);
      setDesc(true);
    }
    setPage(1);
  };

  const toggleRarity = (r: Rarity) => {
    setRarities((list) => (list.includes(r) ? list.filter((x) => x !== r) : [...list, r]));
    setPage(1);
  };

  const onRowClick = (row: Row) => {
    if (!row.owned) return;
    if (picking) {
      setPicked((p) => (p.includes(row.card.id) ? p.filter((x) => x !== row.card.id) : p.length >= 10 ? p : [...p, row.card.id]));
      return;
    }
    openDetail(row.card.id);
  };

  const pct = (n: number, d: number) => (d ? fmt((n / d) * 100, { maximumFractionDigits: n / d < 0.01 ? 3 : 1 }) : '0');

  return (
    <div className="page stack collection-page">
      <section className="panel">
        <div className="col-head">
          <h2 className="col-title display">{t('col.title')}</h2>
          <div className="col-summary mono">
            <Trans
              k="col.summary"
              values={{
                unique: <b>{fmt(owned.length)}</b>,
                total: fmt(db.all.length),
                pct: <span className="hl">({pct(owned.length, db.all.length)}%)</span>,
                packs: <b>{fmt(packsOpened)}</b>,
                cards: <b>{fmt(cardsPulled)}</b>,
              }}
            />
          </div>
        </div>
        <div className="rarity-stats">
          {[...RARITY_ORDER].reverse().map((r) => {
            const total = db.byRarity[r].length;
            return (
              <button key={r} className={`rs ${rarities.includes(r) ? 'on' : ''}`} style={{ ['--rc' as string]: RARITIES[r].color }} onClick={() => toggleRarity(r)} title={t('col.filterRarity', { r })}>
                <span className="rs-top">
                  <b className="display">{r}</b>
                  <span className="mono">
                    {fmt(stats[r])}/{fmt(total)}
                  </span>
                </span>
                <span className="rs-bar">
                  <i style={{ width: `${(stats[r] / total) * 100}%` }} />
                </span>
                <span className="rs-pct mono">{pct(stats[r], total)}%</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel showcase-panel">
        <div>
          <b className="showcase-title">{t('col.showcase')}</b>
          <p className="dim">{t('col.showcaseDesc')}</p>
        </div>
        {picking ? (
          <div className="row">
            <span className="mono dim">{picked.length}/10</span>
            <button className="btn btn-sm" onClick={() => (setPicking(false), setPicked([]))}>
              {t('common.cancel')}
            </button>
            <button className="btn btn-sm btn-hazard" disabled={!picked.length} onClick={() => setShowcase(true)}>
              {t('col.showcaseView')}
            </button>
          </div>
        ) : (
          <button className="btn" onClick={() => setPicking(true)} disabled={!owned.length}>
            {t('col.showcaseBuild')}
          </button>
        )}
      </section>

      <section className="panel filters">
        <div className="row sort-row">
          <span className="dim small">{t('col.sortBy')}</span>
          {SORTS.map((s) => (
            <button key={s.id} className={`chip ${sort === s.id ? 'on' : ''}`} onClick={() => chooseSort(s.id)}>
              {t(s.label)}
              {sort === s.id ? (desc ? ' ↓' : ' ↑') : ''}
            </button>
          ))}
          <button className={`chip ${favOnly ? 'on' : ''}`} onClick={() => (setFavOnly(!favOnly), setPage(1))}>
            <Icon name="star" size={13} className={favOnly ? 'filled' : ''} /> {t('col.favorites')}
          </button>
        </div>
        <div className="filter-grid">
          <input className="field" placeholder={t('col.searchName')} value={query} onChange={(e) => (setQuery(e.target.value), setPage(1))} />
          <input className="field" placeholder={t('col.searchTag')} value={tagQuery} onChange={(e) => (setTagQuery(e.target.value), setPage(1))} />
          <select className="field" value={cls} onChange={(e) => (setCls(e.target.value as ObjClass | ''), setPage(1))}>
            <option value="">{t('col.allClasses')}</option>
            {CLASS_ORDER.map((c) => (
              <option key={c} value={c}>
                {className(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <label className="switch">
            <input type="checkbox" checked={showMissing} onChange={(e) => (setShowMissing(e.target.checked), setPage(1))} />
            <span>{t('col.showMissing')}</span>
          </label>
          <div className="grow" />
          <div className="seg">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>
              {t('col.viewList')}
            </button>
            <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>
              {t('col.viewGrid')}
            </button>
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <div className="empty-note">{owned.length === 0 ? t('col.empty') : t('col.noMatch')}</div>
      ) : view === 'list' ? (
        <div className="col-table" role="table">
          <div className="ct-head" role="row">
            <span>{t('col.th.rank')}</span>
            <span>{t('card.qShort')}</span>
            <span>{t('col.th.file')}</span>
            <span className="num">ATK</span>
            <span className="num">DEF</span>
            <span className="num">{t('col.sort.count')}</span>
          </div>
          {visible.map((row) => {
            const { card, owned: o } = row;
            const isPicked = picked.includes(card.id);
            return (
              <div
                key={card.id}
                role="row"
                className={`ct-row ${o ? '' : 'missing'} ${isPicked ? 'picked' : ''}`}
                style={{ ['--rc' as string]: RARITIES[card.rarity].color }}
                onClick={() => onRowClick(row)}
              >
                <span className="ct-rank display">{card.rarity}</span>
                <span className="ct-q mono">{o ? fmt(card.q, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</span>
                <span className="ct-title">
                  {o && (
                    <button
                      className={`fav ${o.fav ? 'on' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFav(card.id);
                      }}
                      aria-label={o.fav ? t('col.unfav') : t('detail.markFavorite')}
                    >
                      <Icon name="star" size={18} className={o.fav ? 'filled' : ''} />
                    </button>
                  )}
                  <span className="ct-name">
                    <span className="ct-line">
                      <b>{card.code}</b> {o ? cardName(card) : <span className="redacted">████████</span>}
                    </span>
                    <span className="ct-meta">
                      <span className="tag" style={{ borderColor: CLASSES[card.cls].color, color: CLASSES[card.cls].color }}>
                        {classLabel(card)}
                      </span>
                      {o &&
                        card.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                    </span>
                  </span>
                </span>
                <span className="num mono">{o ? fmt(card.atk) : '???'}</span>
                <span className="num mono">{o ? fmt(card.def) : '???'}</span>
                <span className="num mono dim">{o ? `×${o.n}` : '—'}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="col-grid">
          {visible.map((row) =>
            row.owned ? (
              <CardMini key={row.card.id} card={row.card} onClick={() => onRowClick(row)} selected={picked.includes(row.card.id)} badge={row.owned.n > 1 ? `×${row.owned.n}` : undefined} />
            ) : (
              <div key={row.card.id} className="locked-tile" style={{ ['--rc' as string]: RARITIES[row.card.rarity].color }}>
                <span className="display">{row.card.rarity}</span>
                <b>{row.card.code}</b>
                <span className="mono">{t('card.classified')}</span>
              </div>
            ),
          )}
        </div>
      )}

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>
            ← {t('col.prev')}
          </button>
          <span className="mono">
            {t('col.page')}{' '}
            <input className="field page-input" type="number" min={1} max={pages} value={curPage} onChange={(e) => setPage(Math.max(1, Math.min(pages, Number(e.target.value) || 1)))} />{' '}
            {t('col.of', { n: pages })}
          </span>
          <button className="btn btn-sm" disabled={curPage >= pages} onClick={() => setPage(curPage + 1)}>
            {t('col.next')} →
          </button>
        </div>
      )}

      <BackupPanel />

      {showcase && (
        <Modal
          title={t('col.showcase')}
          icon={<Icon name="archive" size={24} />}
          wide
          onClose={() => setShowcase(false)}
          footer={
            <>
              <ShareButton request={() => ({ context: 'collection', cards: picked.map((id) => db.byId.get(id)!).filter(Boolean) })} />
              <button className="btn btn-primary" onClick={() => (setShowcase(false), setPicking(false), setPicked([]))}>
                {t('common.done')}
              </button>
            </>
          }
        >
          <div className="showcase">
            {picked.map((id) => {
              const c = db.byId.get(id);
              return c ? <CardFace key={id} card={c} width="min(220px, 62vw)" tilt onClick={() => openDetail(id)} /> : null;
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

type Msg = { ok: boolean; key: Key; params?: Record<string, string | number> };

function BackupPanel() {
  const save = useSave((s) => s);
  const importSave = useGame((s) => s.importSave);
  const resetAll = useGame((s) => s.resetAll);
  const { t } = useT();
  const [text, setText] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<Msg | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const word = t('backup.confirmWord');

  const restore = (raw: string) => {
    try {
      const data = decodeBackup(raw);
      importSave(data);
      setMsg({ ok: true, key: 'backup.restored', params: { n: Object.keys(data.collection).length } });
      setText('');
    } catch (e) {
      setMsg({ ok: false, key: e instanceof BackupError ? (e.key as Key) : 'backup.err.format' });
    }
  };

  const exportFile = () => {
    const blob = new Blob([encodeBackup(save)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t('backup.fileName')}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg({ ok: true, key: 'backup.downloaded' });
  };

  return (
    <div className="backup-grid">
      <section className="panel">
        <h3 className="panel-title">{t('backup.title')}</h3>
        <p className="dim small">{t('backup.desc')}</p>
        <div className="row">
          <button className="btn btn-sm" onClick={exportFile}>
            {t('backup.export')}
          </button>
          <button
            className="btn btn-sm"
            onClick={async () => {
              if (await copyText(encodeBackup(save))) setMsg({ ok: true, key: 'backup.copied' });
            }}
          >
            {t('backup.copy')}
          </button>
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
            {t('backup.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) restore(await f.text());
              e.target.value = '';
            }}
          />
        </div>
        <textarea className="field backup-text" placeholder={t('backup.placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-sm" disabled={!text.trim()} onClick={() => restore(text)}>
          {t('backup.restore')}
        </button>
        {msg && <p className={`small ${msg.ok ? 'ok' : 'err'}`}>{t(msg.key, msg.params)}</p>}
      </section>
      <section className="panel danger">
        <h3 className="panel-title">{t('backup.danger')}</h3>
        <p className="dim small">
          <Trans k="backup.dangerDesc" values={{ word: <b className="mono">{word}</b> }} />
        </p>
        <div className="row">
          <input className="field" style={{ maxWidth: 180 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={word} />
          <button
            className="btn btn-danger"
            disabled={confirm.trim().toUpperCase() !== word}
            onClick={() => {
              resetAll();
              setConfirm('');
              setMsg({ ok: true, key: 'backup.wiped' });
            }}
          >
            {t('backup.wipe')}
          </button>
        </div>
      </section>
    </div>
  );
}
