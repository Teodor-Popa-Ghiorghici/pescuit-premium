import { useEffect, useState } from 'react';
import { useT } from '../i18n/useT.js';

/** Renders public/RULES.md (a build-time copy of the repo's RULES.md) so the game
 *  explains itself. It stays in English regardless of the UI language toggle -- see
 *  DECISIONS.md for why translating the whole rulebook was out of scope. */
export function RulesPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [text, setText] = useState('');

  useEffect(() => {
    fetch('/RULES.md')
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('RULES.md unavailable.'));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2>{t('rules.title')}</h2>
          <button className="btn btn--ghost" onClick={onClose}>
            ×
          </button>
        </div>
        <pre className="rules-modal__text">{text}</pre>
      </div>
    </div>
  );
}
