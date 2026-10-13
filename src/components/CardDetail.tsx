import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cardDesc, cardName, cards, isTranslated, wikiUrl } from '../data/cards';
import { RARITIES } from '../data/rarity';
import { CLASSES } from '../data/classes';
import { useGame } from '../store/game';
import { useUi } from '../store/ui';
import { useT } from '../i18n';
import { classAbility, classAbilityDesc, classLabel, clearance, clearanceName, rarityName, seriesLabel } from '../i18n/labels';
import { CardFace } from './Card';
import { Icon } from './Icon';
import { ShareButton } from './ShareButton';
import './detail.css';

export function CardDetail() {
  const id = useUi((s) => s.detailCardId);
  const close = useUi((s) => s.openDetail);
  const owned = useGame((s) => (id ? s.save.collection[id] : undefined));
  const level = useGame((s) => (id ? s.save.story.levels[id] : undefined));
  const toggleFav = useGame((s) => s.toggleFav);
  const markRead = useGame((s) => s.markRead);
  const { t, fmt, fmtDate } = useT();

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, close]);

  if (!id) return null;
  const card = cards().byId.get(id);
  if (!card) return null;
  const rar = RARITIES[card.rarity];
  const cls = CLASSES[card.cls];
  const name = cardName(card);
  const translated = isTranslated(card);

  return createPortal(
    <div className="detail-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
      <div className="detail" role="dialog" aria-modal="true" aria-label={`${card.code} ${name}`}>
        <button className="icon-btn detail-close" onClick={() => close(null)} aria-label={t('common.close')}>
          <Icon name="close" size={18} />
        </button>
        <div className="detail-card">
          <CardFace card={card} width="min(300px, 74vw)" tilt level={level} />
        </div>
        <div className="detail-info">
          <div className="detail-rarity" style={{ color: rar.color }}>
            <span className="display">{card.rarity}</span> {rarityName(card.rarity)} · {clearance(card.rarity)} — {clearanceName(card.rarity)}
          </div>
          <h2 className="detail-title">
            <span className="display">{card.code}</span>
            {name && <span className="detail-name">{name}</span>}
            {name && name !== card.name && card.name && <span className="detail-original">{t('detail.originalTitle', { name: card.name })}</span>}
          </h2>

          <section className="detail-desc" aria-label={t('detail.description')}>
            <header className="detail-desc-head mono">
              <span>{t('detail.description')}</span>
              <span className="faint">{t('detail.descriptionFrom')} · {card.code}</span>
            </header>
            <div className="detail-desc-body">
              <DescriptionText text={cardDesc(card)} />
            </div>
          </section>

          <dl className="detail-grid">
            <div>
              <dt>{t('detail.class')}</dt>
              <dd style={{ color: cls.color }}>{classLabel(card)}</dd>
            </div>
            <div>
              <dt>{t('detail.q')}</dt>
              <dd className="mono">{fmt(card.q, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 100</dd>
            </div>
            <div>
              <dt>{t('detail.rating')}</dt>
              <dd className="mono">
                {card.rating >= 0 ? '+' : ''}
                {fmt(card.rating)}
              </dd>
            </div>
            <div>
              <dt>{t('detail.series')}</dt>
              <dd>{seriesLabel(card.series)}</dd>
            </div>
            <div>
              <dt>{t('detail.author')}</dt>
              <dd>
                {card.author || t('detail.unknownAuthor')}
                {card.year ? ` · ${card.year}` : ''}
              </dd>
            </div>
            <div>
              <dt>{t('detail.copies')}</dt>
              <dd className="mono">{owned ? `×${owned.n}` : t('detail.notOwned')}</dd>
            </div>
          </dl>

          <div className="ability" style={{ borderColor: cls.color }}>
            <div className="ability-name" style={{ color: cls.color }}>
              {t('detail.ability')} · {classAbility(card.cls)}
            </div>
            <div className="ability-desc">{classAbilityDesc(card.cls)}</div>
          </div>

          {card.tags.length > 0 && (
            <div className="row" style={{ gap: 6 }}>
              {card.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {owned && <div className="detail-dates faint mono">{t('detail.firstObtained', { date: fmtDate(owned.first) })}</div>}

          <div className="row detail-actions">
            <ShareButton compact request={() => ({ context: 'card', cards: [card] })} />
            {owned && (
              <button className={`btn btn-sm ${owned.fav ? 'btn-hazard' : ''}`} onClick={() => toggleFav(card.id)}>
                <Icon name="star" size={15} className={owned.fav ? 'filled' : ''} /> {owned.fav ? t('detail.favorite') : t('detail.markFavorite')}
              </button>
            )}
            <a className="btn btn-sm" href={wikiUrl(card)} target="_blank" rel="noreferrer" onClick={() => markRead()}>
              {t('detail.readFull')} ↗
            </a>
          </div>
          {translated && (
            <p className="detail-mt">
              <Icon name="globe" size={13} /> {t('detail.machineTranslation')}
            </p>
          )}
          <p className="detail-license faint">{t('detail.license', { code: card.code, author: card.author || t('detail.unknownAuthorLower') })}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Descripción completa: párrafos separados por línea en blanco y listas con viñetas ("• "). */
function DescriptionText({ text }: { text: string }) {
  const { t } = useT();
  if (!text) return <p className="detail-desc-expunged">{t('card.expunged')}</p>;
  return (
    <>
      {text.split(/\n{2,}/).map((block, i) => {
        const lines = block.split('\n');
        const intro = lines[0].startsWith('• ') ? null : lines[0];
        const items = lines.slice(intro === null ? 0 : 1).filter((l) => l.startsWith('• '));
        return (
          <div key={i} className="detail-desc-block">
            {intro !== null && <p>{intro}</p>}
            {items.length > 0 && (
              <ul>
                {items.map((it, j) => (
                  <li key={j}>{it.slice(2)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
