import { useState } from 'preact/hooks';
import { t } from '../i18n';

export const inviteLink = (code: string) => `${location.origin}${location.pathname}#/join/${code}`;

/** The invite link with Copy / Share, plus "Let a new device join" for a returning partner. */
export function Invite({
  code,
  returning,
  partner,
  onNewDevice,
  title,
}: {
  code: string;
  returning: boolean;
  partner: string;
  onNewDevice?: () => void;
  /** Heading instead of "Invite your partner" (e.g. for a third player). */
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = inviteLink(code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt(t('copyPrompt'), link);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: t('appName'), text: t('shareText'), url: link });
    } catch {
      /* cancelled */
    }
  }

  return (
    <section class={`invite ${returning ? 'compact' : ''}`}>
      {returning ? (
        <p>{t('returning', partner)}</p>
      ) : (
        <>
          <h2>{title ?? t('inviteTitle')}</h2>
          <p class="muted">{t('inviteHint')}</p>
        </>
      )}
      <div class="invite-row">
        <input
          class="mono"
          dir="ltr"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t('inviteLink')}
        />
        <button class="btn primary" onClick={copy}>
          {copied ? t('copied') : t('copy')}
        </button>
        {'share' in navigator && (
          <button class="btn" onClick={share}>
            {t('share')}
          </button>
        )}
      </div>
      {returning && onNewDevice && (
        <div class="new-device">
          <button class="btn ghost small" onClick={onNewDevice}>
            {t('newDevice')}
          </button>
          <span class="muted small">{t('newDeviceHint', partner)}</span>
        </div>
      )}
    </section>
  );
}
