import type { RedactedLaidSet, RedactedView } from '@pescuit/engine';
import { Seal } from '../art/seals.js';
import { useT } from '../i18n/useT.js';

/**
 * One laid set, pressed flat (§5.7): a small plate with its seal, a pip gouged in when it was laid, and -
 * for a power set - a collar core that ignites when the power is granted. A face-down set is the same
 * uniform back for every hidden rank: nothing on it depends on the rank, only on the public category
 * (`isPowerSet`), on whether it is spent, and on whether the Mantis cracked it.
 */
export function SetPlate({ set }: { set: RedactedLaidSet }) {
  const { t, rank } = useT();
  const hidden = set.rank === null;
  const label = hidden ? t('log.hiddenSet') : rank(set.rank!);
  const cls = ['setplate', set.isPowerSet && 'is-power', hidden && 'is-hidden', set.spent && 'is-spent', set.destroyedByMantis && 'is-destroyed'].filter(Boolean).join(' ');
  return (
    <span className={cls} data-set-id={set.id} title={label} role="img" aria-label={label}>
      {hidden ? <span className="setplate__back" /> : <Seal rank={set.rank!} size={12} color="currentColor" />}
      {set.isPowerSet && <span className="setplate__core" />}
      <span className="setplate__pip" />
      <span className="setplate__crack" />
    </span>
  );
}

/** the laid sets under a post (desktop) or beside your own name */
export function LaidRow({ view, owner, className = '', max }: { view: RedactedView; owner: string; className?: string; max?: number }) {
  const { t } = useT();
  const sets = view.laidSets.filter((s) => s.ownerId === owner);
  // on a phone the row is compact: the newest sets as plates, the rest counted ("+N"); the full list is in the log drawer
  const shown = max !== undefined && sets.length > max ? sets.slice(sets.length - (max - 1)) : sets;
  const more = sets.length - shown.length;
  return (
    <div className={`laid ${className}`} data-laid-owner={owner} role="group" aria-label={t('game.laidSets', { count: sets.length })}>
      {more > 0 && (
        <span className="laid__more num" aria-hidden="true">
          +{more}
        </span>
      )}
      {shown.map((s) => (
        <SetPlate key={s.id} set={s} />
      ))}
    </div>
  );
}
