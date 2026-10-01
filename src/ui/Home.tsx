import { useState } from 'preact/hooks';
import { formatCode, isValidCode, normalizeCode } from '../core/ids';
import { KEYS, load, remove, save } from '../core/storage';
import { lang, setLang, t } from '../i18n';
import { GuestSession, HostSession, type Session } from '../net/session';

interface Props {
  onSession: (s: Session) => void;
  /** Set when opened from an invite link. */
  inviteCode: string | null;
}

export function Home({ onSession, inviteCode }: Props) {
  const [name, setName] = useState(() => load<string>(KEYS.name) ?? '');
  const [code, setCode] = useState(inviteCode ? formatCode(inviteCode) : '');
  const [error, setError] = useState('');
  const [hostSave, setHostSave] = useState(HostSession.saved);
  const [guestSave, setGuestSave] = useState(GuestSession.saved);

  function withName(then: (n: string) => void) {
    const n = name.trim();
    if (!n) {
      setError(t('needName'));
      return;
    }
    save(KEYS.name, n);
    then(n);
  }

  function join() {
    const c = normalizeCode(code);
    if (!isValidCode(c)) {
      setError(t('badCode'));
      return;
    }
    withName((n) => onSession(new GuestSession(c, n)));
  }

  const nameField = (
    <label class="field">
      <span>{t('yourName')}</span>
      <input
        value={name}
        maxLength={24}
        dir="auto"
        placeholder={t('namePlaceholder')}
        autoComplete="nickname"
        onInput={(e) => {
          setName(e.currentTarget.value);
          setError('');
        }}
      />
    </label>
  );

  if (inviteCode) {
    return (
      <main class="home">
        <Hero />
        <section class="panel">
          <h2>{t('invited')}</h2>
          <p class="muted">
            {t('room')}{' '}
            <b class="mono" dir="ltr">
              {formatCode(inviteCode)}
            </b>
          </p>
          {nameField}
          {error && <p class="error">{error}</p>}
          <button class="btn primary wide" onClick={join}>
            {t('joinTheTable')}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main class="home">
      <Hero />

      {(hostSave || guestSave) && (
        <section class="panel resume">
          <h2>{t('continue')}</h2>
          {hostSave && (
            <div class="resume-row">
              <span>
                {t('yourRoom')}{' '}
                <b class="mono" dir="ltr">
                  {formatCode(hostSave.code)}
                </b>{' '}
                {hostSave.guestName && t('withName', hostSave.guestName)}
              </span>
              <button class="btn primary small" onClick={() => onSession(HostSession.restore(hostSave))}>
                {t('reopen')}
              </button>
              <button
                class="btn ghost small"
                onClick={() => {
                  remove(KEYS.host);
                  setHostSave(null);
                }}
              >
                {t('forget')}
              </button>
            </div>
          )}
          {guestSave && (
            <div class="resume-row">
              <span>
                {t('joinedRoom')}{' '}
                <b class="mono" dir="ltr">
                  {formatCode(guestSave.code)}
                </b>
              </span>
              <button
                class="btn primary small"
                onClick={() => onSession(new GuestSession(guestSave.code, name.trim() || guestSave.name))}
              >
                {t('rejoin')}
              </button>
              <button
                class="btn ghost small"
                onClick={() => {
                  remove(KEYS.guest);
                  setGuestSave(null);
                }}
              >
                {t('forget')}
              </button>
            </div>
          )}
        </section>
      )}

      <section class="panel">
        {nameField}
        {error && <p class="error">{error}</p>}
        <div class="home-actions">
          <div class="home-card">
            <h3>{t('startTable')}</h3>
            <p class="muted small">{t('startTableHint')}</p>
            <button class="btn primary wide" onClick={() => withName((n) => onSession(HostSession.create(n)))}>
              {t('createRoom')}
            </button>
          </div>
          <div class="home-card">
            <h3>{t('joinTable')}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <input
                class="mono code-input"
                dir="ltr"
                value={code}
                placeholder="ABCDE-FGH23"
                maxLength={14}
                autoCapitalize="characters"
                autoComplete="off"
                spellcheck={false}
                aria-label={t('roomCode')}
                onInput={(e) => {
                  setCode(e.currentTarget.value);
                  setError('');
                }}
              />
              <button class="btn wide">{t('join')}</button>
            </form>
          </div>
        </div>
      </section>

      <p class="footnote">{t('footnote')}</p>
    </main>
  );
}

function Hero() {
  return (
    <header class="hero">
      <img src="./favicon.svg" alt="" width={56} height={56} />
      <div>
        <h1>{t('appName')}</h1>
        <p>{t('tagline')}</p>
      </div>
      <button class="btn ghost small lang-toggle" onClick={() => setLang(lang.value === 'ar' ? 'en' : 'ar')}>
        {t('otherLang')}
      </button>
    </header>
  );
}
