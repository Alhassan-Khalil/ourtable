import { useState } from 'preact/hooks';
import { KEYS, load, save } from '../../core/storage';
import type { SetupProps } from '../../core/types';
import { t } from '../../i18n';
import { classicDeck } from './faces';
import { MAX_CARDS, MIN_CARDS, type Card, type GWOptions } from './logic';
import { photoToCard } from './photos';

export function Setup({ onStart, onCancel }: SetupProps<GWOptions>) {
  const [cards, setCards] = useState<Card[]>(() => load<Card[]>(KEYS.lastDeck) ?? []);
  const [mode, setMode] = useState<'classic' | 'photos'>(() => (cards.length >= MIN_CARDS ? 'photos' : 'classic'));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setNote('');
    const room = MAX_CARDS - cards.length;
    const picked = Array.from(files).slice(0, room);
    const added: Card[] = [];
    const failed: string[] = [];
    for (const f of picked) {
      try {
        added.push(await photoToCard(f));
      } catch {
        failed.push(f.name);
      }
    }
    setCards((prev) => [...prev, ...added].slice(0, MAX_CARDS));
    const notes = [];
    if (files.length > room) notes.push(t('gw.tooMany', MAX_CARDS));
    if (failed.length) notes.push(t('gw.cantRead', failed.join('، ')));
    setNote(notes.join(' '));
    setBusy(false);
  }

  const rename = (id: string, name: string) => setCards((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  const drop = (id: string) => setCards((prev) => prev.filter((c) => c.id !== id));

  function start() {
    if (mode === 'classic') {
      onStart({ deck: classicDeck(), deckName: 'classic' });
      return;
    }
    const deck = cards.map((c, i) => ({ ...c, name: c.name.trim() || t('gw.person', i + 1) }));
    save(KEYS.lastDeck, deck); // best effort: next time the set is pre-loaded
    onStart({ deck, deckName: 'photos' });
  }

  const photosReady = cards.length >= MIN_CARDS;
  const preview = classicDeck().slice(0, 8);

  return (
    <div class="panel setup">
      <h2>{t('gw.setupTitle')}</h2>

      <div class="choice-row">
        <button class={`choice ${mode === 'classic' ? 'on' : ''}`} onClick={() => setMode('classic')}>
          <div class="choice-faces">
            {preview.map((c) => (
              <img key={c.id} src={c.img} alt="" />
            ))}
          </div>
          <strong>{t('gw.classic')}</strong>
          <span>{t('gw.classicHint')}</span>
        </button>
        <button class={`choice ${mode === 'photos' ? 'on' : ''}`} onClick={() => setMode('photos')}>
          <div class="choice-faces">
            {cards.slice(0, 8).map((c) => (
              <img key={c.id} src={c.img} alt="" />
            ))}
            {cards.length === 0 && <span class="choice-empty">📷</span>}
          </div>
          <strong>{t('gw.photos')}</strong>
          <span>{t('gw.photosHint', MIN_CARDS, MAX_CARDS)}</span>
        </button>
      </div>

      {mode === 'photos' && (
        <div class="photos">
          <label class={`btn ${busy ? 'disabled' : ''}`}>
            {busy ? t('gw.processing') : t('gw.addPhotos')}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={busy || cards.length >= MAX_CARDS}
              onChange={(e) => {
                const input = e.currentTarget;
                void addFiles(input.files).then(() => (input.value = ''));
              }}
            />
          </label>
          <span class="muted">
            {cards.length} / {MAX_CARDS} {!photosReady && t('gw.addAtLeast', MIN_CARDS)}
          </span>
          {cards.length > 0 && (
            <button class="btn ghost small" onClick={() => setCards([])}>
              {t('gw.clearAll')}
            </button>
          )}
          {note && <p class="note">{note}</p>}
          <p class="muted small">{t('gw.photosPrivacy')}</p>
          <div class="photo-grid">
            {cards.map((c) => (
              <div class="photo-item" key={c.id}>
                <img src={c.img} alt="" />
                <input
                  value={c.name}
                  maxLength={24}
                  dir="auto"
                  placeholder={t('gw.nameLabel')}
                  aria-label={t('gw.nameLabel')}
                  class={c.name.trim() ? '' : 'needs-name'}
                  onInput={(e) => rename(c.id, e.currentTarget.value)}
                />
                <button class="photo-remove" onClick={() => drop(c.id)} aria-label={t('gw.remove', c.name)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="actions">
        <button class="btn ghost" onClick={onCancel}>
          {t('back')}
        </button>
        <button class="btn primary" disabled={mode === 'photos' && (!photosReady || busy)} onClick={start}>
          {t('startGame')}
        </button>
      </div>
    </div>
  );
}
