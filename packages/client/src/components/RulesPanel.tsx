import { lazy, Suspense, useEffect, useState } from 'react';
import { softPress } from '../audio/ui.js';
import { useDialog } from '../hooks/useDialog.js';
import { useCodexT } from '../i18n/codexStrings.js';
import { useT } from '../i18n/useT.js';

const Codex = lazy(() => import('./Codex.js'));

/** Renders public/RULES.md (a build-time copy of the repo's RULES.md) so the game
 *  explains itself, and the Codex (§5.8): the nine powers with their motifs. The rulebook stays in
 *  English regardless of the UI language toggle -- see DECISIONS.md for why translating the whole
 *  rulebook was out of scope; the Codex is in both languages. */
export default function RulesPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const tc = useCodexT();
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'rules' | 'codex'>('rules');

  useEffect(() => {
    fetch('/RULES.md')
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('RULES.md unavailable.'));
  }, []);

  const dialog = useDialog<HTMLDivElement>(onClose);


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialog} className="modal rules-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('rules.title')} data-rules>
        <div className="modal__header">
          <h2>{tab === 'codex' ? tc('codex.title') : t('rules.title')}</h2>
          <button
            className="btn modal__close"
            onClick={() => {
              softPress();
              onClose();
            }}
            aria-label={t('nav.close')}
          >
            ×
          </button>
        </div>
        <div className="seg rules-tabs" role="tablist" aria-label={t('rules.title')}>
          {(['rules', 'codex'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`seg__btn ${tab === k ? 'is-on' : ''}`} onClick={() => setTab(k)}>
              {k === 'rules' ? tc('codex.tabRules') : tc('codex.tabCodex')}
            </button>
          ))}
        </div>
        {tab === 'rules' ? (
          <pre className="rules-modal__text">{text}</pre>
        ) : (
          <Suspense fallback={null}>
            <Codex />
          </Suspense>
        )}
      </div>
    </div>
  );
}
